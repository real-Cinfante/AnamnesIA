"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { formatearRut } from "@/lib/rut";
import type { Paciente } from "@/lib/types";

const API_BASE = "/api/backend";

// ── Types ─────────────────────────────────────────────────────────────────────

type EstadoConsulta = "transcribiendo" | "listo" | "generando" | "pendiente" | "revisada" | "validada" | "error";

interface ConsultaResumen {
  id: string;
  paciente_nombre: string;
  fecha: string;
  estado: EstadoConsulta;
  duracion_segundos: number | null;
  tiene_historia: boolean;
  validated_at: string | null;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS: Record<EstadoConsulta, { label: string; dotBg: string; bg: string; text: string; border: string; animate?: boolean }> = {
  transcribiendo: { label: "Transcribiendo",    dotBg: "#f59e0b", bg: "#fffbeb", text: "#92400e", border: "#fde68a", animate: true },
  listo:          { label: "Lista para revisar", dotBg: "#38bdf8", bg: "#f0f9ff", text: "#075985", border: "#bae6fd" },
  generando:      { label: "Generando HC",       dotBg: "#a78bfa", bg: "#f5f3ff", text: "#4c1d95", border: "#ddd6fe", animate: true },
  pendiente:      { label: "Pendiente",          dotBg: "#fb923c", bg: "#fff7ed", text: "#7c2d12", border: "#fed7aa" },
  revisada:       { label: "Revisada",           dotBg: "#facc15", bg: "#fefce8", text: "#713f12", border: "#fef08a" },
  validada:       { label: "Validada",           dotBg: "var(--forest-400)", bg: "var(--forest-50)", text: "var(--forest-800)", border: "var(--forest-200)" },
  error:          { label: "Error",              dotBg: "#f87171", bg: "#fef2f2", text: "#991b1b", border: "#fecaca" },
};

function StatusBadge({ estado }: { estado: EstadoConsulta }) {
  const cfg = STATUS[estado] ?? STATUS.error;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      <span
        className={`status-dot ${cfg.animate ? "animate-pulse-dot" : ""}`}
        style={{ backgroundColor: cfg.dotBg }}
        aria-hidden="true"
      />
      {cfg.label}
    </span>
  );
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function formatDuracion(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export default function PacientePage({ params }: Props) {
  const pacienteId = params.id;

  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [consultas, setConsultas] = useState<ConsultaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [pr, cr] = await Promise.all([
        fetch(`${API_BASE}/api/pacientes/${pacienteId}`),
        fetch(`${API_BASE}/api/pacientes/${pacienteId}/consultas`),
      ]);
      if (pr.status === 404) throw new Error("Paciente no encontrado.");
      if (!pr.ok) throw new Error(`Error HTTP ${pr.status}`);
      const [pj, cj] = await Promise.all([pr.json(), cr.json()]);
      setPaciente(pj.data);
      setConsultas(cr.ok ? (cj.data?.items ?? cj.data ?? []) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [pacienteId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const perfil = paciente?.perfil_clinico;
  const perfilVacio = !perfil ||
    (perfil.condiciones_activas.length === 0 &&
     perfil.medicamentos_actuales.length === 0 &&
     perfil.alergias.length === 0 &&
     perfil.antecedentes_quirurgicos.length === 0);

  return (
    <AppShell>
      <div className="flex flex-col gap-7 animate-fade-in max-w-4xl">

        {/* Back link */}
        <Link
          href="/pacientes"
          className="inline-flex items-center gap-1.5 text-sm transition-colors w-fit"
          style={{ color: "var(--stone)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--forest-800)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--stone)"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Pacientes
        </Link>

        {/* Error */}
        {error && (
          <div
            className="px-4 py-3 rounded-xl text-sm"
            style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-5">
            <div className="skeleton h-9 w-64 rounded-xl" />
            <div className="skeleton h-4 w-32 rounded" />
            <div
              className="rounded-2xl p-6"
              style={{ backgroundColor: "var(--parchment)", border: "1px solid var(--border-warm)" }}
            >
              <div className="flex flex-col gap-3">
                <div className="skeleton h-4 w-full rounded" />
                <div className="skeleton h-4 w-3/4 rounded" />
                <div className="skeleton h-4 w-1/2 rounded" />
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {!loading && paciente && (
          <>
            {/* Header */}
            <div>
              <h1
                className="font-display text-3xl tracking-tight"
                style={{ color: "var(--ink)" }}
              >
                {paciente.nombre}
              </h1>
              <p className="text-sm font-mono mt-1" style={{ color: "var(--stone)" }}>
                {formatearRut(paciente.rut)}
                {paciente.fecha_nacimiento && (
                  <> · {new Date(paciente.fecha_nacimiento).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" })}</>
                )}
                {paciente.sexo && (
                  <> · {paciente.sexo === "M" ? "Masculino" : paciente.sexo === "F" ? "Femenino" : "Otro"}</>
                )}
              </p>
            </div>

            {/* Perfil clínico */}
            <div
              className="rounded-2xl p-6 flex flex-col gap-5"
              style={{
                backgroundColor: "var(--parchment)",
                border: "1px solid var(--border-warm)",
                boxShadow: "0 1px 4px rgba(17,23,20,0.05)",
              }}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-base" style={{ color: "var(--ink)" }}>
                  Perfil clínico
                </h2>
                {perfil?.ultima_actualizacion && (
                  <span className="text-xs" style={{ color: "var(--stone)" }}>
                    Actualizado {new Date(perfil.ultima_actualizacion).toLocaleDateString("es-CL")}
                  </span>
                )}
              </div>

              {perfilVacio ? (
                <p className="text-sm py-2" style={{ color: "var(--stone)" }}>
                  El perfil se construirá automáticamente al validar historias clínicas.
                </p>
              ) : (
                <div className="flex flex-col gap-5">

                  {/* Condiciones activas */}
                  {perfil!.condiciones_activas.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--stone)" }}>
                        Condiciones activas
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {perfil!.condiciones_activas.map((c, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: "var(--forest-100)", color: "var(--forest-700)", border: "1px solid var(--forest-200)" }}
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Medicamentos */}
                  {perfil!.medicamentos_actuales.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--stone)" }}>
                        Medicamentos actuales
                      </p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: "1px solid var(--border-warm)" }}>
                            <th className="text-left py-1.5 pr-4 text-xs font-semibold" style={{ color: "var(--stone)" }}>Nombre</th>
                            <th className="text-left py-1.5 pr-4 text-xs font-semibold" style={{ color: "var(--stone)" }}>Dosis</th>
                            <th className="text-left py-1.5 text-xs font-semibold" style={{ color: "var(--stone)" }}>Desde</th>
                          </tr>
                        </thead>
                        <tbody>
                          {perfil!.medicamentos_actuales.map((m, i) => (
                            <tr key={i} style={{ borderBottom: i < perfil!.medicamentos_actuales.length - 1 ? "1px solid var(--border-warm)" : undefined }}>
                              <td className="py-2 pr-4 font-medium" style={{ color: "var(--ink)" }}>{m.nombre}</td>
                              <td className="py-2 pr-4" style={{ color: "var(--stone)" }}>{m.dosis}</td>
                              <td className="py-2 text-xs font-mono" style={{ color: "var(--stone)" }}>{m.desde}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Alergias */}
                  {perfil!.alergias.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--stone)" }}>
                        Alergias
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {perfil!.alergias.map((a, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Antecedentes quirúrgicos */}
                  {perfil!.antecedentes_quirurgicos.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--stone)" }}>
                        Antecedentes quirúrgicos
                      </p>
                      <ul className="flex flex-col gap-1">
                        {perfil!.antecedentes_quirurgicos.map((a, i) => (
                          <li key={i} className="text-sm flex items-start gap-2" style={{ color: "var(--ink)" }}>
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--stone)" }} aria-hidden="true" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {perfil!.consultas_procesadas > 0 && (
                    <p className="text-xs" style={{ color: "var(--stone)" }}>
                      Basado en {perfil!.consultas_procesadas} consulta{perfil!.consultas_procesadas !== 1 ? "s" : ""} procesada{perfil!.consultas_procesadas !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Historial de consultas */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: "var(--parchment)",
                border: "1px solid var(--border-warm)",
                boxShadow: "0 1px 4px rgba(17,23,20,0.05)",
              }}
            >
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--border-warm)" }}
              >
                <h2 className="font-semibold text-base" style={{ color: "var(--ink)" }}>
                  Historial de consultas
                </h2>
                <span className="text-xs tabular-nums" style={{ color: "var(--stone)" }}>
                  {consultas.length} consulta{consultas.length !== 1 ? "s" : ""}
                </span>
              </div>

              {consultas.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: "var(--forest-50)", border: "1px solid var(--forest-100)" }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest-400)" strokeWidth="1.5" aria-hidden="true">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                      <rect x="8" y="2" width="8" height="4" rx="1"/>
                      <path d="M9 12h6M9 16h4"/>
                    </svg>
                  </div>
                  <p className="text-sm" style={{ color: "var(--stone)" }}>
                    Sin consultas registradas para este paciente.
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm" role="table">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-warm)", backgroundColor: "rgba(228,221,211,0.3)" }}>
                      <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--stone)" }}>Fecha</th>
                      <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--stone)" }}>Estado</th>
                      <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--stone)" }}>Duración</th>
                      <th scope="col" className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--stone)" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consultas.map((c, idx) => (
                      <tr
                        key={c.id}
                        style={{ borderBottom: idx < consultas.length - 1 ? "1px solid var(--border-warm)" : undefined }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(240,237,231,0.5)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                      >
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-xs tabular-nums whitespace-nowrap" style={{ color: "var(--ink)" }}>
                            {formatFecha(c.fecha)}
                          </p>
                          <p className="text-xs font-mono mt-0.5" style={{ color: "var(--stone)" }}>
                            {c.id.slice(0, 8)}…
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge estado={c.estado} />
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs tabular-nums" style={{ color: "var(--stone)" }}>
                          {formatDuracion(c.duracion_segundos)}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/consulta/${c.id}`}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                              style={{
                                border: "1px solid var(--border-warm)",
                                color: "var(--stone)",
                                backgroundColor: "transparent",
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--cream)"; (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--stone)"; }}
                            >
                              Ver
                            </Link>
                            {c.tiene_historia && (
                              <Link
                                href={`/consulta/${c.id}/historia`}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                                style={{
                                  border: "1px solid var(--forest-200)",
                                  color: "var(--forest-800)",
                                  backgroundColor: "var(--forest-50)",
                                }}
                              >
                                Historia
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
