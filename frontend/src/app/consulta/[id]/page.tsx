"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import VisorTranscripcion from "@/components/visor-transcripcion";
import { AppShell } from "@/components/app-shell";
import type { Transcripcion } from "@/lib/types";

const API_BASE = "/api/backend";
const POLL_MS = 2000;

// ── Estado chip config ─────────────────────────────────────────────────────────

const ESTADO_CHIP: Record<string, { bg: string; border: string; text: string; dotBg?: string }> = {
  transcribiendo: { bg: "#fffbeb", border: "#fde68a", text: "#92400e", dotBg: "#f59e0b" },
  listo:          { bg: "var(--forest-50)", border: "var(--forest-200)", text: "var(--forest-800)" },
  error:          { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" },
};

const ESTADO_LABEL: Record<string, string> = {
  transcribiendo: "Transcribiendo",
  listo:          "Transcripción lista",
  error:          "Error",
};

// ── Page ───────────────────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export default function ConsultaPage({ params }: Props) {
  const consultaId = params.id;

  const [data, setData] = useState<Transcripcion | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch con polling ────────────────────────────────────────────────────────

  const fetchTranscripcion = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/consultas/${consultaId}/transcripcion`);
      if (res.status === 404) {
        setFetchError("Consulta no encontrada.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const next: Transcripcion = json.data;
      setData(next);
      setFetchError("");

      if (next.estado !== "transcribiendo" && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Error al cargar transcripción");
    }
  }, [consultaId]);

  useEffect(() => {
    fetchTranscripcion();
    pollRef.current = setInterval(fetchTranscripcion, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchTranscripcion]);

  // ── Audio player sync ─────────────────────────────────────────────────────────

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  }, []);

  const handleSeek = useCallback((segundos: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = segundos;
    audio.play().catch(() => {/* autoplay policy — silenciar */});
  }, []);

  const audioUrl = data?.audio_url ? `${API_BASE}${data.audio_url}` : null;
  const estado   = data?.estado ?? "transcribiendo";
  const chipCfg  = ESTADO_CHIP[estado] ?? ESTADO_CHIP.transcribiendo;

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto flex flex-col gap-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link
              href="/consultas"
              className="inline-flex items-center gap-1.5 text-sm mb-2 transition-colors"
              style={{ color: "var(--stone)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--forest-800)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--stone)"; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Consultas
            </Link>
            <h1
              className="font-display text-3xl"
              style={{ color: "var(--ink)" }}
            >
              Transcripción
            </h1>
            <p
              className="text-xs font-mono mt-0.5"
              style={{ color: "var(--stone)" }}
            >
              {consultaId}
            </p>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
              style={{ backgroundColor: chipCfg.bg, border: `1px solid ${chipCfg.border}`, color: chipCfg.text }}
            >
              {chipCfg.dotBg && (
                <span
                  className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                  style={{ backgroundColor: chipCfg.dotBg }}
                  aria-hidden="true"
                />
              )}
              {ESTADO_LABEL[estado] ?? estado}
            </span>

            {estado === "listo" && (
              <Link
                href={`/consulta/${consultaId}/historia`}
                className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-600) 100%)",
                  color: "#fff",
                  boxShadow: "0 2px 8px rgba(28,61,47,0.2)",
                }}
              >
                Generar historia →
              </Link>
            )}
          </div>
        </div>

        {/* Error de fetch */}
        {fetchError && (
          <div
            className="px-4 py-3 rounded-xl text-sm"
            style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}
          >
            {fetchError}
          </div>
        )}

        {/* Error de transcripción */}
        {estado === "error" && data?.error && (
          <div
            className="px-4 py-3 rounded-xl text-sm"
            style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}
          >
            Error en transcripción: {data.error}
          </div>
        )}

        {/* Reproductor de audio */}
        {audioUrl && (
          <div
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{
              backgroundColor: "var(--parchment)",
              border: "1px solid var(--border-warm)",
              boxShadow: "0 1px 4px rgba(17,23,20,0.05)",
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--stone)" }}
            >
              Audio de la consulta
            </p>
            <audio
              ref={audioRef}
              src={audioUrl}
              controls
              onTimeUpdate={handleTimeUpdate}
              className="w-full h-10"
              style={{ accentColor: "var(--forest-400)" }}
            />
            <p className="text-xs" style={{ color: "var(--stone)" }}>
              Haz click en cualquier segmento para saltar al momento exacto.
            </p>
          </div>
        )}

        {/* Cargando */}
        {estado === "transcribiendo" && (
          <div
            className="rounded-2xl p-10 flex flex-col items-center gap-4 text-center"
            style={{
              backgroundColor: "var(--parchment)",
              border: "1px solid var(--border-warm)",
            }}
          >
            <div
              className="w-9 h-9 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--forest-400)", borderTopColor: "transparent" }}
            />
            <div>
              <p className="font-semibold" style={{ color: "var(--ink)" }}>Transcribiendo con Whisper…</p>
              <p className="text-sm mt-1" style={{ color: "var(--stone)" }}>
                Esto puede tardar unos segundos dependiendo de la duración del audio.
              </p>
            </div>
          </div>
        )}

        {/* Transcripción */}
        {estado === "listo" && data && (
          <div
            className="rounded-2xl p-6"
            style={{
              backgroundColor: "var(--parchment)",
              border: "1px solid var(--border-warm)",
              boxShadow: "0 1px 4px rgba(17,23,20,0.05)",
            }}
          >
            {/* Leyenda */}
            <div
              className="flex items-center gap-4 mb-5 pb-4"
              style={{ borderBottom: "1px solid var(--border-warm)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mr-auto" style={{ color: "var(--stone)" }}>
                {data.segmentos.length} segmentos
              </p>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: "var(--forest-800)" }}
                />
                <span className="text-xs" style={{ color: "var(--stone)" }}>Médico</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: "var(--stone)" }}
                />
                <span className="text-xs" style={{ color: "var(--stone)" }}>Paciente</span>
              </div>
              {data.segmentos.some(s => s.hablante === "medico_examen") && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block bg-amber-500" />
                  <span className="text-xs" style={{ color: "var(--stone)" }}>Examen</span>
                </div>
              )}
            </div>

            {/* Visor */}
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <VisorTranscripcion
                segmentos={data.segmentos}
                currentTime={currentTime}
                onSeek={handleSeek}
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
