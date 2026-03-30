"use client";

import { useState, useCallback, useRef } from "react";
import type { HistoriaClinica, HistoriaEstado, HistoriaPipelineEstado } from "@/lib/types";

// ── Secciones clínicas ─────────────────────────────────────────────────────────

type Campo = keyof Pick<
  HistoriaClinica,
  "anamnesis" | "antecedentes" | "examen_fisico" | "diagnostico_presuntivo" | "indicaciones"
>;

const SECCIONES: { key: Campo; label: string; descripcion: string }[] = [
  {
    key: "anamnesis",
    label: "Anamnesis",
    descripcion: "Motivo de consulta y síntomas relatados por el paciente",
  },
  {
    key: "antecedentes",
    label: "Antecedentes",
    descripcion: "Antecedentes médicos, quirúrgicos, familiares y farmacológicos",
  },
  {
    key: "examen_fisico",
    label: "Examen físico",
    descripcion: "Hallazgos del examen físico realizado",
  },
  {
    key: "diagnostico_presuntivo",
    label: "Diagnóstico presuntivo",
    descripcion: "Hipótesis diagnóstica o diagnóstico diferencial",
  },
  {
    key: "indicaciones",
    label: "Indicaciones",
    descripcion: "Tratamiento indicado, medicamentos, dosis y derivaciones",
  },
];

// ── Badge de estado ────────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<HistoriaPipelineEstado, { bg: string; border: string; text: string }> = {
  borrador:  { bg: "var(--parchment)",    border: "var(--border-warm)",  text: "var(--stone)"      },
  revisada:  { bg: "#fffbeb",            border: "#fde68a",             text: "#92400e"           },
  validada:  { bg: "var(--forest-50)",   border: "var(--forest-200)",   text: "var(--forest-800)" },
  generando: { bg: "var(--parchment)",   border: "var(--border-warm)",  text: "var(--stone)"      },
  error:     { bg: "#fef2f2",            border: "#fecaca",             text: "#991b1b"           },
};

const ESTADO_LABEL: Record<HistoriaPipelineEstado, string> = {
  borrador:  "Borrador",
  revisada:  "Revisada",
  validada:  "Validada",
  generando: "Generando…",
  error:     "Error",
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface EditorHistoriaProps {
  historia: Omit<HistoriaClinica, "estado"> & { estado: HistoriaEstado };
  onSave: (campos: Partial<HistoriaClinica>) => Promise<void>;
  onValidar: () => Promise<void>;
}

// ── Componente ─────────────────────────────────────────────────────────────────

export default function EditorHistoria({
  historia,
  onSave,
  onValidar,
}: EditorHistoriaProps) {
  const [campos, setCampos] = useState<Record<Campo, string>>({
    anamnesis: historia.anamnesis,
    antecedentes: historia.antecedentes,
    examen_fisico: historia.examen_fisico,
    diagnostico_presuntivo: historia.diagnostico_presuntivo,
    indicaciones: historia.indicaciones,
  });
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [validando, setValidando] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const estado = historia.estado;
  const isValidada = estado === "validada";
  const badgeCfg = ESTADO_BADGE[estado] ?? ESTADO_BADGE.borrador;

  // ── Edición con auto-save ──────────────────────────────────────────────────

  const handleChange = useCallback(
    (key: Campo, value: string) => {
      setCampos((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
      setSaveState("idle");

      // Auto-save debounced a 1.5s
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setSaveState("saving");
        try {
          await onSave({ [key]: value });
          setSaveState("saved");
          setDirty(false);
          setTimeout(() => setSaveState("idle"), 2000);
        } catch {
          setSaveState("error");
        }
      }, 1500);
    },
    [onSave]
  );

  const handleSaveNow = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    try {
      await onSave(campos);
      setSaveState("saved");
      setDirty(false);
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }, [onSave, campos]);

  // ── Validación ─────────────────────────────────────────────────────────────

  const handleValidar = useCallback(async () => {
    setMostrarConfirm(false);
    setValidando(true);
    try {
      await onValidar();
    } finally {
      setValidando(false);
    }
  }, [onValidar]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-5">

      {/* Header con badge y controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold border"
            style={{ backgroundColor: badgeCfg.bg, borderColor: badgeCfg.border, color: badgeCfg.text }}
          >
            {estado === "validada" && (
              <svg className="inline-block mr-1 -mt-px" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>
            )}
            {ESTADO_LABEL[estado]}
          </span>
          {historia.editada_por_medico && (
            <span className="text-xs" style={{ color: "var(--stone)" }}>Editada por médico</span>
          )}
          {historia.validated_at && (
            <span className="text-xs font-mono" style={{ color: "var(--stone)" }}>
              {new Date(historia.validated_at).toLocaleString("es-CL")}
            </span>
          )}
        </div>

        {/* Save status */}
        <div className="flex items-center gap-3">
          {saveState === "saving" && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--stone)" }}>
              <span
                className="w-3 h-3 border border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "var(--border-warm)", borderTopColor: "transparent" }}
              />
              Guardando…
            </span>
          )}
          {saveState === "saved" && (
            <span className="text-xs font-medium" style={{ color: "var(--forest-600)" }}>Guardado</span>
          )}
          {saveState === "error" && (
            <span className="text-xs" style={{ color: "#dc2626" }}>Error al guardar</span>
          )}
          {dirty && saveState === "idle" && !isValidada && (
            <button
              onClick={handleSaveNow}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              style={{
                border: "1px solid var(--forest-800)",
                color: "var(--forest-800)",
                backgroundColor: "transparent",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "var(--forest-50)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              }}
            >
              Guardar ahora
            </button>
          )}
        </div>
      </div>

      {/* Secciones clínicas */}
      {SECCIONES.map(({ key, label, descripcion }) => (
        <div
          key={key}
          className="rounded-2xl p-6 transition-shadow"
          style={{
            backgroundColor: "var(--parchment)",
            border: "1px solid var(--border-warm)",
            boxShadow: "0 1px 3px rgba(17,23,20,0.05)",
          }}
        >
          <div className="mb-3">
            <h3
              className="font-semibold text-[15px]"
              style={{ color: "var(--ink)" }}
            >
              {label}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--stone)" }}>{descripcion}</p>
          </div>
          <textarea
            value={campos[key]}
            onChange={(e) => handleChange(key, e.target.value)}
            disabled={isValidada}
            rows={4}
            className="w-full px-4 py-3 rounded-xl text-sm leading-relaxed resize-y transition-all focus:outline-none"
            style={{
              backgroundColor: isValidada ? "var(--forest-50)" : "#fff",
              border: `1px solid ${isValidada ? "var(--forest-200)" : "var(--border-warm)"}`,
              color: "var(--ink)",
              cursor: isValidada ? "not-allowed" : undefined,
            }}
            onFocus={e => {
              if (!isValidada) {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--forest-400)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(78,168,125,0.12)";
              }
            }}
            onBlur={e => {
              (e.currentTarget as HTMLElement).style.borderColor = isValidada ? "var(--forest-200)" : "var(--border-warm)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
            placeholder="Sin información registrada."
          />
        </div>
      ))}

      {/* Botones de acción */}
      {!isValidada && (
        <div
          className="flex items-center justify-between pt-4"
          style={{ borderTop: "1px solid var(--border-warm)" }}
        >
          <p className="text-xs" style={{ color: "var(--stone)" }}>
            Revisa cada sección antes de validar. Una vez validada no se puede editar.
          </p>

          <div className="flex gap-3">
            {estado === "borrador" && (
              <button
                onClick={() => onSave({ estado: "revisada" } as Partial<HistoriaClinica>)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                style={{
                  border: "1px solid var(--border-warm)",
                  color: "var(--stone)",
                  backgroundColor: "transparent",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--parchment)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                Marcar revisada
              </button>
            )}

            <button
              onClick={() => setMostrarConfirm(true)}
              disabled={validando}
              className="px-7 py-2 rounded-xl text-white text-sm font-semibold transition-shadow disabled:opacity-50 cursor-pointer"
              style={{
                background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-400) 100%)",
                boxShadow: "0 2px 8px rgba(28,61,47,0.2)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(28,61,47,0.3)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(28,61,47,0.2)";
              }}
            >
              {validando ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Validando…
                </span>
              ) : (
                "Validar historia"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Historia validada */}
      {isValidada && (
        <div
          className="flex items-center gap-4 px-5 py-4 rounded-2xl"
          style={{
            backgroundColor: "var(--forest-50)",
            border: "1px solid var(--forest-200)",
          }}
        >
          <div
            className="flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0"
            style={{ backgroundColor: "var(--forest-800)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: "var(--forest-800)" }}>
              Historia clínica validada
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--stone)" }}>
              Esta historia ha sido revisada y validada por el médico. No puede ser editada.
            </p>
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      {mostrarConfirm && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50" style={{ backgroundColor: "rgba(7,21,17,0.5)" }}>
          <div
            className="rounded-2xl p-8 max-w-sm w-full mx-4 animate-scale-in"
            style={{
              backgroundColor: "#fff",
              boxShadow: "0 24px 64px rgba(7,21,17,0.25)",
            }}
          >
            <h3
              className="font-display text-2xl mb-2"
              style={{ color: "var(--ink)" }}
            >
              Validar historia
            </h3>
            <p className="text-sm mb-6" style={{ color: "var(--stone)" }}>
              Una vez validada, la historia no podrá editarse. Asegúrate de haber
              revisado todas las secciones.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMostrarConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
                style={{
                  border: "1px solid var(--border-warm)",
                  color: "var(--stone)",
                  backgroundColor: "transparent",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--parchment)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
              >
                Cancelar
              </button>
              <button
                onClick={handleValidar}
                className="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-400) 100%)",
                  boxShadow: "0 2px 8px rgba(28,61,47,0.2)",
                }}
              >
                Sí, validar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
