"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import GrabadorAudio from "@/components/grabador-audio";
import { AppShell } from "@/components/app-shell";
import Link from "next/link";
import { validarRut, normalizarRut, formatearRut } from "@/lib/rut";
import type { Paciente } from "@/lib/types";

const API_BASE = "/api/backend";

const EXT_MAP: Record<string, string> = {
  "audio/webm": "webm", "audio/webm;codecs=opus": "webm",
  "audio/ogg": "ogg",   "audio/ogg;codecs=opus": "ogg",
  "audio/mp4": "mp4",   "audio/mpeg": "mp3", "audio/wav": "wav",
};

type FlowState = "rut" | "buscando" | "encontrado" | "nuevo" | "grabando";

export default function NuevaConsultaPage() {
  const router = useRouter();

  // Flow state
  const [flowState, setFlowState] = useState<FlowState>("rut");

  // RUT state
  const [rutInput, setRutInput] = useState("");

  // Patient state
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [pacienteNombre, setPacienteNombre] = useState("");

  // New patient form
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoFechaNacimiento, setNuevoFechaNacimiento] = useState("");
  const [nuevoSexo, setNuevoSexo] = useState("");

  // Error states
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");

  // ── RUT input handling ───────────────────────────────────────────────────────

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits, dots, dash, K
    const filtered = raw.replace(/[^0-9.\-kK]/g, "").toUpperCase();
    setRutInput(filtered);
    setError("");
  };

  const rutNormalizado = normalizarRut(rutInput);
  const rutValido = validarRut(rutInput);
  const rutSuficiente = rutNormalizado.replace("-", "").length >= 8;
  const mostrarValidacion = rutSuficiente || rutInput.includes("-");

  // ── Search patient ───────────────────────────────────────────────────────────

  const buscarPaciente = useCallback(async () => {
    if (!rutValido) return;
    setError("");
    setFlowState("buscando");
    try {
      const res = await fetch(`${API_BASE}/api/pacientes/buscar?rut=${encodeURIComponent(rutNormalizado)}`);
      if (res.status === 404) {
        setFlowState("nuevo");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error HTTP ${res.status}`);
      }
      const j = await res.json();
      setPaciente(j.data);
      setPacienteId(j.data.id);
      setPacienteNombre(j.data.nombre);
      setFlowState("encontrado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al buscar paciente");
      setFlowState("rut");
    }
  }, [rutValido, rutNormalizado]);

  // ── Create new patient ───────────────────────────────────────────────────────

  const crearPaciente = useCallback(async () => {
    if (!nuevoNombre.trim()) return;
    setError("");
    try {
      const body: Record<string, string> = {
        rut: rutNormalizado,
        nombre: nuevoNombre.trim(),
      };
      if (nuevoFechaNacimiento) body.fecha_nacimiento = nuevoFechaNacimiento;
      if (nuevoSexo) body.sexo = nuevoSexo;

      const res = await fetch(`${API_BASE}/api/pacientes/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error HTTP ${res.status}`);
      }
      const j = await res.json();
      setPacienteId(j.data.id);
      setPacienteNombre(j.data.nombre);
      setFlowState("grabando");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al crear paciente");
    }
  }, [nuevoNombre, nuevoFechaNacimiento, nuevoSexo, rutNormalizado]);

  // ── Upload audio ─────────────────────────────────────────────────────────────

  const handleComplete = useCallback(async (blob: Blob, mimeType: string) => {
    setUploadError("");
    const ext = EXT_MAP[mimeType.split(";")[0].trim()] ?? "webm";
    const form = new FormData();
    form.append("audio", blob, `consulta.${ext}`);
    form.append("tipo", "consulta");
    if (pacienteId) {
      form.append("paciente_id", pacienteId);
    } else {
      form.append("paciente_nombre", pacienteNombre);
    }

    try {
      const res = await fetch(`${API_BASE}/api/audio/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error HTTP ${res.status}`);
      }
      const j = await res.json();
      router.push(`/consulta/${j.data.consulta_id}`);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Error al subir el audio");
    }
  }, [pacienteId, pacienteNombre, router]);

  // ── Shared input style ───────────────────────────────────────────────────────

  const inputStyle = {
    border: "1.5px solid var(--border-warm)",
    backgroundColor: "#fff",
    color: "var(--ink)",
  };

  const inputClassName = "w-full px-4 py-3 rounded-xl text-sm placeholder:opacity-50 focus:outline-none transition-all";

  const onInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    (e.currentTarget as HTMLElement).style.borderColor = "var(--forest-400)";
    (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(78,168,125,0.12)";
  };
  const onInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    (e.currentTarget as HTMLElement).style.borderColor = "var(--border-warm)";
    (e.currentTarget as HTMLElement).style.boxShadow = "none";
  };

  return (
    <AppShell>
      <div className="max-w-xl mx-auto animate-fade-in">

        {/* Back link */}
        <Link
          href="/consultas"
          className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
          style={{ color: "var(--stone)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--forest-800)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--stone)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Consultas
        </Link>

        {/* Header */}
        <div className="mb-7">
          <h1
            className="font-display text-3xl tracking-tight"
            style={{ color: "var(--ink)" }}
          >
            Nueva consulta
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--stone)" }}>
            {flowState === "grabando"
              ? `Paciente: ${pacienteNombre}`
              : "Ingresa el RUT del paciente para comenzar."}
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-7 flex flex-col gap-7"
          style={{
            backgroundColor: "var(--parchment)",
            border: "1px solid var(--border-warm)",
            boxShadow: "0 2px 8px rgba(17,23,20,0.06)",
          }}
        >

          {/* ── STATE: rut ── */}
          {flowState === "rut" && (
            <div className="flex flex-col gap-5">
              <div>
                <label
                  htmlFor="rut-paciente"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "var(--ink)" }}
                >
                  RUT del paciente{" "}
                  <span style={{ color: "#dc2626" }} aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <input
                    id="rut-paciente"
                    type="text"
                    value={rutInput}
                    onChange={handleRutChange}
                    placeholder="12.345.678-5"
                    autoFocus
                    autoComplete="off"
                    className={inputClassName}
                    style={{
                      ...inputStyle,
                      paddingRight: mostrarValidacion ? "2.5rem" : undefined,
                      borderColor: mostrarValidacion
                        ? rutValido ? "var(--forest-400)" : "#f87171"
                        : "var(--border-warm)",
                    }}
                    onFocus={onInputFocus}
                    onBlur={onInputBlur}
                    onKeyDown={e => { if (e.key === "Enter" && rutValido) buscarPaciente(); }}
                  />
                  {mostrarValidacion && (
                    <span
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base font-bold select-none"
                      style={{ color: rutValido ? "var(--forest-400)" : "#f87171" }}
                      aria-hidden="true"
                    >
                      {rutValido ? "✓" : "✗"}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs" style={{ color: "var(--stone)" }}>
                  Formato: 12.345.678-5 o 12345678-5
                </p>
                {mostrarValidacion && !rutValido && (
                  <p className="mt-1 text-xs" style={{ color: "#dc2626" }} role="alert">
                    RUT inválido. Verifica el dígito verificador.
                  </p>
                )}
              </div>

              {error && (
                <div
                  className="px-4 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                onClick={buscarPaciente}
                disabled={!rutValido}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-600) 100%)",
                  color: "#fff",
                  boxShadow: rutValido ? "0 2px 10px rgba(28,61,47,0.2)" : "none",
                }}
              >
                Buscar paciente
              </button>
            </div>
          )}

          {/* ── STATE: buscando ── */}
          {flowState === "buscando" && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div
                className="w-9 h-9 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "var(--forest-400)", borderTopColor: "transparent" }}
              />
              <p className="text-sm font-medium" style={{ color: "var(--stone)" }}>
                Buscando paciente...
              </p>
            </div>
          )}

          {/* ── STATE: encontrado ── */}
          {flowState === "encontrado" && paciente && (
            <div className="flex flex-col gap-5">
              <div
                className="rounded-xl p-5 flex flex-col gap-3"
                style={{ backgroundColor: "var(--forest-50)", border: "1px solid var(--forest-100)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className="font-display text-xl tracking-tight"
                      style={{ color: "var(--ink)" }}
                    >
                      {paciente.nombre}
                    </p>
                    <p className="text-xs font-mono mt-0.5" style={{ color: "var(--stone)" }}>
                      {formatearRut(paciente.rut)}
                    </p>
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                    style={{ backgroundColor: "var(--forest-100)", color: "var(--forest-800)", border: "1px solid var(--forest-200)" }}
                  >
                    Paciente registrado
                  </span>
                </div>

                {paciente.perfil_clinico?.condiciones_activas?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--stone)" }}>
                      Condiciones activas
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {paciente.perfil_clinico.condiciones_activas.map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: "var(--forest-100)", color: "var(--forest-700)", border: "1px solid var(--forest-200)" }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {paciente.perfil_clinico?.medicamentos_actuales?.length > 0 && (
                  <p className="text-xs" style={{ color: "var(--stone)" }}>
                    <span className="font-semibold" style={{ color: "var(--ink)" }}>
                      {paciente.perfil_clinico.medicamentos_actuales.length}
                    </span>{" "}
                    medicamento{paciente.perfil_clinico.medicamentos_actuales.length !== 1 ? "s" : ""} activo{paciente.perfil_clinico.medicamentos_actuales.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              <button
                onClick={() => setFlowState("grabando")}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-600) 100%)",
                  color: "#fff",
                  boxShadow: "0 2px 10px rgba(28,61,47,0.2)",
                }}
              >
                Iniciar grabación →
              </button>

              <button
                onClick={() => { setFlowState("rut"); setRutInput(""); setPaciente(null); setPacienteId(null); }}
                className="text-sm text-center underline underline-offset-2 transition-colors cursor-pointer"
                style={{ color: "var(--stone)" }}
              >
                Buscar otro paciente
              </button>
            </div>
          )}

          {/* ── STATE: nuevo ── */}
          {flowState === "nuevo" && (
            <div className="flex flex-col gap-5">
              <div
                className="px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}
              >
                Paciente no registrado. Ingresa sus datos para continuar.
              </div>

              <div>
                <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--stone)" }}>
                  RUT
                </p>
                <p className="text-sm font-mono" style={{ color: "var(--ink)" }}>
                  {formatearRut(rutNormalizado)}
                </p>
              </div>

              {/* Nombre */}
              <div>
                <label
                  htmlFor="nuevo-nombre"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "var(--ink)" }}
                >
                  Nombre completo{" "}
                  <span style={{ color: "#dc2626" }} aria-hidden="true">*</span>
                </label>
                <input
                  id="nuevo-nombre"
                  type="text"
                  value={nuevoNombre}
                  onChange={e => setNuevoNombre(e.target.value)}
                  placeholder="Ej: María González"
                  autoFocus
                  autoComplete="off"
                  className={inputClassName}
                  style={inputStyle}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                />
              </div>

              {/* Fecha nacimiento */}
              <div>
                <label
                  htmlFor="nuevo-fecha"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "var(--ink)" }}
                >
                  Fecha de nacimiento{" "}
                  <span className="text-xs font-normal" style={{ color: "var(--stone)" }}>(opcional)</span>
                </label>
                <input
                  id="nuevo-fecha"
                  type="date"
                  value={nuevoFechaNacimiento}
                  onChange={e => setNuevoFechaNacimiento(e.target.value)}
                  className={inputClassName}
                  style={inputStyle}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                />
              </div>

              {/* Sexo */}
              <div>
                <label
                  htmlFor="nuevo-sexo"
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "var(--ink)" }}
                >
                  Sexo{" "}
                  <span className="text-xs font-normal" style={{ color: "var(--stone)" }}>(opcional)</span>
                </label>
                <select
                  id="nuevo-sexo"
                  value={nuevoSexo}
                  onChange={e => setNuevoSexo(e.target.value)}
                  className={inputClassName + " cursor-pointer"}
                  style={inputStyle}
                  onFocus={onInputFocus}
                  onBlur={onInputBlur}
                >
                  <option value="">Sin especificar</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              {error && (
                <div
                  className="px-4 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                onClick={crearPaciente}
                disabled={nuevoNombre.trim().length < 2}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-600) 100%)",
                  color: "#fff",
                  boxShadow: "0 2px 10px rgba(28,61,47,0.2)",
                }}
              >
                Crear y continuar
              </button>

              <button
                onClick={() => { setFlowState("rut"); setRutInput(""); setNuevoNombre(""); setNuevoFechaNacimiento(""); setNuevoSexo(""); }}
                className="text-sm text-center underline underline-offset-2 transition-colors cursor-pointer"
                style={{ color: "var(--stone)" }}
              >
                Volver
              </button>
            </div>
          )}

          {/* ── STATE: grabando ── */}
          {flowState === "grabando" && (
            <>
              {/* Patient badge */}
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ backgroundColor: "var(--forest-50)", border: "1px solid var(--forest-100)" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ backgroundColor: "var(--forest-200)", color: "var(--forest-800)" }}
                  aria-hidden="true"
                >
                  {pacienteNombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{pacienteNombre}</p>
                  <p className="text-xs font-mono" style={{ color: "var(--stone)" }}>
                    {formatearRut(rutNormalizado)}
                  </p>
                </div>
              </div>

              {/* Separador */}
              <div style={{ height: "1px", backgroundColor: "var(--border-warm)" }} role="separator" />

              {/* Grabador */}
              <div>
                <p
                  className="text-sm font-semibold mb-5"
                  style={{ color: "var(--ink)" }}
                >
                  Grabación de consulta
                </p>
                <GrabadorAudio onComplete={handleComplete} disabled={false} />
              </div>

              {/* Upload error */}
              {uploadError && (
                <div
                  className="px-4 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}
                  role="alert"
                >
                  {uploadError}
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </AppShell>
  );
}
