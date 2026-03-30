"use client";

import { useEffect, useRef } from "react";
import type { Segmento, Hablante } from "@/lib/types";

// ── Bubble config por hablante ─────────────────────────────────────────────────

const BUBBLE: Record<Hablante, {
  label: string;
  side: "left" | "right" | "full";
  bubbleBg: string;
  bubbleBorder: string;
  labelBg: string;
  labelText: string;
}> = {
  medico: {
    label:       "Médico",
    side:        "left",
    bubbleBg:    "var(--forest-50)",
    bubbleBorder: "var(--forest-200)",
    labelBg:     "var(--forest-800)",
    labelText:   "#fff",
  },
  paciente: {
    label:       "Paciente",
    side:        "right",
    bubbleBg:    "var(--parchment)",
    bubbleBorder: "var(--border-warm)",
    labelBg:     "var(--stone)",
    labelText:   "#fff",
  },
  medico_examen: {
    label:       "Examen",
    side:        "full",
    bubbleBg:    "#fffbeb",
    bubbleBorder: "#fde68a",
    labelBg:     "#d97706",
    labelText:   "#fff",
  },
  sin_clasificar: {
    label:       "?",
    side:        "left",
    bubbleBg:    "var(--parchment)",
    bubbleBorder: "var(--border-warm)",
    labelBg:     "#e5e7eb",
    labelText:   "var(--stone)",
  },
};

function fmtTs(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  segmentos: Segmento[];
  currentTime: number;
  onSeek: (s: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VisorTranscripcion({ segmentos, currentTime, onSeek }: Props) {
  const activeRef = useRef<HTMLDivElement>(null);

  const activeIdx = segmentos.findIndex(
    s => currentTime >= s.inicio_segundos && currentTime < s.fin_segundos
  );

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeIdx]);

  if (segmentos.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-36 gap-2"
        style={{ color: "var(--stone)" }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p className="text-sm">Sin segmentos de transcripción.</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 px-0.5"
      role="log"
      aria-label="Transcripción de la consulta"
      aria-live="off"
    >
      {segmentos.map((seg, i) => {
        const cfg    = BUBBLE[seg.hablante] ?? BUBBLE.sin_clasificar;
        const active = i === activeIdx;
        const isFull = cfg.side === "full";
        const isRight = cfg.side === "right";

        return (
          <div
            key={seg.id ?? i}
            ref={active ? activeRef : undefined}
            className={`flex gap-2 items-end ${isFull ? "flex-col" : isRight ? "flex-row-reverse" : "flex-row"}`}
          >
            {/* Speaker badge */}
            <div className="flex-shrink-0 mb-1">
              <span
                className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: cfg.labelBg, color: cfg.labelText }}
              >
                {cfg.label}
              </span>
            </div>

            {/* Bubble */}
            <button
              onClick={() => onSeek(seg.inicio_segundos)}
              className={[
                "group relative rounded-xl px-4 py-2.5 text-left transition-all duration-150 cursor-pointer",
                isFull ? "w-full" : "max-w-[68%]",
              ].join(" ")}
              style={{
                backgroundColor: cfg.bubbleBg,
                border: `1px solid ${active ? "var(--forest-400)" : cfg.bubbleBorder}`,
                boxShadow: active
                  ? "0 0 0 2px rgba(78,168,125,0.2), 0 2px 8px rgba(28,61,47,0.08)"
                  : "0 1px 3px rgba(17,23,20,0.04)",
                transform: active ? "scale(1.008)" : undefined,
                borderLeftWidth: cfg.side === "left" ? "3px" : undefined,
                borderLeftColor: cfg.side === "left" ? (active ? "var(--forest-400)" : "var(--forest-200)") : undefined,
              }}
              aria-label={`Saltar a ${fmtTs(seg.inicio_segundos)} — ${cfg.label}: ${seg.texto}`}
              title={`Saltar a ${fmtTs(seg.inicio_segundos)}`}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(28,61,47,0.1)";
                  (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(17,23,20,0.04)";
                  (e.currentTarget as HTMLElement).style.transform = "";
                }
              }}
            >
              {/* Text */}
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--ink)" }}
              >
                {seg.texto}
              </p>

              {/* Timestamps */}
              <div className={`flex items-center gap-1 mt-1.5 ${isRight ? "justify-start" : "justify-end"}`}>
                <span
                  className="font-mono text-[10px] transition-colors"
                  style={{ color: active ? "var(--forest-600)" : "var(--stone)" }}
                >
                  {fmtTs(seg.inicio_segundos)}
                </span>
                <span className="text-[10px]" style={{ color: "var(--border-warm)" }}>–</span>
                <span
                  className="font-mono text-[10px]"
                  style={{ color: "var(--stone)" }}
                >
                  {fmtTs(seg.fin_segundos)}
                </span>
                {active && (
                  <span
                    className="ml-1 w-1.5 h-1.5 rounded-full animate-pulse-dot flex-shrink-0"
                    style={{ backgroundColor: "var(--forest-400)" }}
                    aria-hidden="true"
                  />
                )}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
