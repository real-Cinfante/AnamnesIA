"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import EditorHistoria from "@/components/editor-historia";
import { AppShell } from "@/components/app-shell";
import type { HistoriaClinica, HistoriaEstado, HistoriaPipelineEstado } from "@/lib/types";

const API_BASE = "/api/backend";
const POLL_MS = 2000;

// ── Helpers ────────────────────────────────────────────────────────────────────

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 404) throw Object.assign(new Error("not_found"), { status: 404 });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const j = await res.json();
  return j.data as T;
}

async function apiPost<T>(url: string, body?: object): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const j = await res.json();
  return j.data as T;
}

async function apiPut<T>(url: string, body: object): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const j = await res.json();
  return j.data as T;
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

type PageEstado =
  | "cargando"
  | "sin_historia"
  | "generando"
  | "lista"
  | "error_generacion"
  | "error_fetch";

export default function HistoriaPage({ params }: Props) {
  const consultaId = params.id;

  const [pageEstado, setPageEstado] = useState<PageEstado>("cargando");
  const [historia, setHistoria]     = useState<HistoriaClinica | null>(null);
  const [errorMsg, setErrorMsg]     = useState("");
  const [generando, setGenerando]   = useState(false);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [validada, setValidada]     = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchHistoria = useCallback(async () => {
    try {
      const data = await apiGet<HistoriaClinica>(
        `${API_BASE}/api/historias/${consultaId}`
      );

      setHistoria(data);
      const est: HistoriaPipelineEstado = data.estado;

      if (est === "generando") {
        setPageEstado("generando");
      } else if (est === "error") {
        setPageEstado("error_generacion");
        setErrorMsg(data.error ?? "Error en la generación");
        stopPoll();
      } else {
        setPageEstado("lista");
        stopPoll();
      }
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 404) {
        setPageEstado("sin_historia");
        stopPoll();
      } else {
        const msg = err instanceof Error ? err.message : "Error de red";
        setErrorMsg(msg);
        setPageEstado("error_fetch");
        stopPoll();
      }
    }
  }, [consultaId]); // eslint-disable-line react-hooks/exhaustive-deps

  function stopPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Fetch paciente_id from consulta
  useEffect(() => {
    apiGet<{ paciente_id?: string }>(`${API_BASE}/api/consultas/${consultaId}`)
      .then(c => setPacienteId(c.paciente_id ?? null))
      .catch(() => {});
  }, [consultaId]);

  useEffect(() => {
    fetchHistoria();
    return () => stopPoll();
  }, [fetchHistoria]);

  useEffect(() => {
    if (pageEstado === "generando" && !pollRef.current) {
      pollRef.current = setInterval(fetchHistoria, POLL_MS);
    }
  }, [pageEstado, fetchHistoria]);

  // ── Acciones ───────────────────────────────────────────────────────────────

  const handleGenerar = useCallback(async () => {
    setGenerando(true);
    setErrorMsg("");
    try {
      await apiPost(`${API_BASE}/api/consultas/${consultaId}/generar-historia`);
      setPageEstado("generando");
      pollRef.current = setInterval(fetchHistoria, POLL_MS);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al generar historia");
      setGenerando(false);
    }
  }, [consultaId, fetchHistoria]);

  const handleSave = useCallback(
    async (campos: Partial<HistoriaClinica>) => {
      const updated = await apiPut<HistoriaClinica>(
        `${API_BASE}/api/historias/${consultaId}`,
        campos
      );
      setHistoria(updated);
    },
    [consultaId]
  );

  const handleValidar = useCallback(async () => {
    const updated = await apiPost<HistoriaClinica>(
      `${API_BASE}/api/historias/${consultaId}/validar`
    );
    setHistoria(updated);
    setPageEstado("lista");
    setValidada(true);
  }, [consultaId]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto flex flex-col gap-6 animate-fade-in">

        {/* Header */}
        <div>
          <Link
            href={`/consulta/${consultaId}`}
            className="inline-flex items-center gap-1.5 text-sm mb-2 transition-colors"
            style={{ color: "var(--stone)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--forest-800)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--stone)"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Transcripción
          </Link>
          <h1
            className="font-display text-3xl"
            style={{ color: "var(--ink)" }}
          >
            Historia clínica
          </h1>
          <p
            className="text-xs font-mono mt-0.5"
            style={{ color: "var(--stone)" }}
          >
            {consultaId}
          </p>
        </div>

        {/* Error de red */}
        {(pageEstado === "error_fetch" || pageEstado === "error_generacion") && (
          <div
            className="px-4 py-3 rounded-xl text-sm"
            style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}
          >
            {errorMsg}
          </div>
        )}

        {/* Cargando inicial */}
        {pageEstado === "cargando" && (
          <div
            className="rounded-2xl p-12 flex justify-center"
            style={{
              backgroundColor: "var(--parchment)",
              border: "1px solid var(--border-warm)",
            }}
          >
            <span
              className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--forest-400)", borderTopColor: "transparent" }}
            />
          </div>
        )}

        {/* Sin historia — botón de generar */}
        {pageEstado === "sin_historia" && (
          <div
            className="rounded-2xl p-12 flex flex-col items-center gap-6 text-center"
            style={{
              backgroundColor: "var(--parchment)",
              border: "1px solid var(--border-warm)",
              boxShadow: "0 2px 8px rgba(17,23,20,0.05)",
            }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "var(--forest-50)", border: "1px solid var(--forest-100)" }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--forest-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 12h6M9 16h4M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1"/>
              </svg>
            </div>
            <div>
              <h2
                className="font-display text-2xl mb-2"
                style={{ color: "var(--ink)" }}
              >
                Generar historia clínica
              </h2>
              <p className="text-sm max-w-sm leading-relaxed" style={{ color: "var(--stone)" }}>
                Claude analizará la transcripción y generará automáticamente las
                secciones clínicas listas para tu revisión.
              </p>
            </div>
            <button
              onClick={handleGenerar}
              disabled={generando}
              className="px-8 py-3 rounded-full text-white font-semibold transition-all disabled:opacity-50 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-600) 100%)",
                boxShadow: "0 4px 16px rgba(28,61,47,0.25)",
              }}
            >
              {generando ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Iniciando…
                </span>
              ) : (
                "Generar con Claude"
              )}
            </button>
            {errorMsg && (
              <p className="text-sm" style={{ color: "#dc2626" }}>{errorMsg}</p>
            )}
          </div>
        )}

        {/* Generando — spinner con polling */}
        {pageEstado === "generando" && (
          <div
            className="rounded-2xl p-12 flex flex-col items-center gap-5 text-center"
            style={{
              backgroundColor: "var(--parchment)",
              border: "1px solid var(--border-warm)",
            }}
          >
            <div
              className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--forest-400)", borderTopColor: "transparent" }}
            />
            <div>
              <p className="font-semibold" style={{ color: "var(--ink)" }}>
                Generando historia clínica…
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--stone)" }}>
                Claude está analizando la transcripción. Tarda unos segundos.
              </p>
            </div>
          </div>
        )}

        {/* Editor */}
        {pageEstado === "lista" && historia && (
          <EditorHistoria
            historia={historia as Omit<HistoriaClinica, "estado"> & { estado: HistoriaEstado }}
            onSave={handleSave}
            onValidar={handleValidar}
          />
        )}

        {/* Panel post-validación */}
        {validada && (
          <div
            className="rounded-2xl p-6 flex flex-col gap-4 animate-fade-in"
            style={{
              backgroundColor: "var(--parchment)",
              border: "1px solid var(--border-warm)",
            }}
          >
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
                ¿Qué hacemos ahora?
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--stone)" }}>
                La historia quedó guardada. Puedes continuar con este paciente o iniciar una nueva consulta.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {pacienteId && (
                <Link
                  href={`/paciente/${pacienteId}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: "var(--forest-800)",
                    color: "#fff",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="5"/>
                    <path d="M3 21v-2a7 7 0 0 1 14 0v2"/>
                  </svg>
                  Ver historial del paciente
                </Link>
              )}
              <Link
                href="/consulta/nueva"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid var(--border-warm)",
                  color: "var(--ink)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--cream)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--forest-300)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border-warm)";
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Nueva consulta
              </Link>
              <Link
                href="/consultas"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  backgroundColor: "transparent",
                  border: "1px solid var(--border-warm)",
                  color: "var(--ink)",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "var(--cream)";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--forest-300)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border-warm)";
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                Ir al dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
