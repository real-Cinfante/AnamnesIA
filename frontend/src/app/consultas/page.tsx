"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";

const API_BASE = "/api/backend";

// ── Tipos ──────────────────────────────────────────────────────────────────────

type EstadoConsulta = "transcribiendo" | "listo" | "generando" | "pendiente" | "revisada" | "validada" | "error";

interface ConsultaResumen {
  id: string;
  paciente_nombre: string;
  paciente_id?: string | null;
  fecha: string;
  estado: EstadoConsulta;
  duracion_segundos: number | null;
  audio_url: string | null;
  tiene_historia: boolean;
  validated_at: string | null;
}

interface PaginatedResult {
  items: ConsultaResumen[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface Stats { total: number; pendientes_validar: number; validadas_hoy: number; }

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function formatDuracion(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ value, label, sub, valueColor }: { value: number; label: string; sub?: string; valueColor?: string }) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-1.5"
      style={{
        backgroundColor: "var(--parchment)",
        border: "1px solid var(--border-warm)",
        boxShadow: "0 1px 3px rgba(17,23,20,0.05)",
      }}
    >
      <span
        className="text-4xl font-display"
        style={{ color: valueColor ?? "var(--ink)", lineHeight: 1.1 }}
      >
        {value}
      </span>
      <span className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{label}</span>
      {sub && <span className="text-xs" style={{ color: "var(--stone)" }}>{sub}</span>}
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

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

// ── Filtros ────────────────────────────────────────────────────────────────────

const ESTADOS_FILTRO = [
  { value: "", label: "Todos los estados" },
  { value: "transcribiendo", label: "Transcribiendo" },
  { value: "listo",          label: "Lista para revisar" },
  { value: "pendiente",      label: "Pendiente revisión" },
  { value: "revisada",       label: "Revisada" },
  { value: "validada",       label: "Validada" },
  { value: "error",          label: "Error" },
];

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ConsultasPage() {
  const [result, setResult] = useState<PaginatedResult | null>(null);
  const [stats, setStats]   = useState<Stats | null>(null);
  const [estadoFiltro, setEstadoFiltro] = useState("");
  const [fechaFiltro,  setFechaFiltro]  = useState("");
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const p = new URLSearchParams({ page: String(page), per_page: "20" });
      if (estadoFiltro) p.set("estado", estadoFiltro);
      if (fechaFiltro)  p.set("fecha",  fechaFiltro);
      const [lr, sr] = await Promise.all([
        fetch(`${API_BASE}/api/consultas?${p}`),
        fetch(`${API_BASE}/api/consultas/stats`),
      ]);
      if (!lr.ok || !sr.ok) throw new Error("Error al cargar datos");
      const [lj, sj] = await Promise.all([lr.json(), sr.json()]);
      setResult(lj.data); setStats(sj.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }, [page, estadoFiltro, fechaFiltro]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const clearFilters = () => { setEstadoFiltro(""); setFechaFiltro(""); setPage(1); };
  const items = result?.items ?? [];
  const tieneResultados = !loading && !error && items.length > 0;
  const estaVacio       = !loading && !error && items.length === 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-7 animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="font-display text-3xl tracking-tight"
              style={{ color: "var(--ink)" }}
            >
              Consultas
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--stone)" }}>
              {new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <Link
            href="/consulta/nueva"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-150"
            style={{
              background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-600) 100%)",
              color: "#fff",
              boxShadow: "0 2px 10px rgba(28,61,47,0.2)",
            }}
            aria-label="Crear nueva consulta"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nueva consulta
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4" role="region" aria-label="Resumen estadístico">
          <StatCard
            value={stats?.total ?? 0}
            label="Total consultas"
          />
          <StatCard
            value={stats?.pendientes_validar ?? 0}
            label="Pendientes de validar"
            sub="en proceso o revisión"
            valueColor="#d97706"
          />
          <StatCard
            value={stats?.validadas_hoy ?? 0}
            label="Validadas hoy"
            valueColor="var(--forest-800)"
          />
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={estadoFiltro}
            onChange={e => { setEstadoFiltro(e.target.value); setPage(1); }}
            aria-label="Filtrar por estado"
            className="px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer focus:outline-none"
            style={{
              border: "1px solid var(--border-warm)",
              backgroundColor: "var(--parchment)",
              color: "var(--ink)",
            }}
          >
            {ESTADOS_FILTRO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <input
            type="date"
            value={fechaFiltro}
            onChange={e => { setFechaFiltro(e.target.value); setPage(1); }}
            aria-label="Filtrar por fecha"
            className="px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer focus:outline-none"
            style={{
              border: "1px solid var(--border-warm)",
              backgroundColor: "var(--parchment)",
              color: "var(--ink)",
            }}
          />

          {(estadoFiltro || fechaFiltro) && (
            <button
              onClick={clearFilters}
              className="text-sm underline underline-offset-2 transition-colors cursor-pointer"
              style={{ color: "var(--stone)" }}
            >
              Limpiar filtros
            </button>
          )}

          {result && (
            <span className="ml-auto text-xs tabular-nums" style={{ color: "var(--stone)" }}>
              {result.total} consulta{result.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div
            className="flex items-center justify-between px-4 py-3 rounded-xl text-sm"
            style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}
            role="alert"
          >
            <span>{error}</span>
            <button onClick={fetchData} className="text-xs underline underline-offset-2 hover:no-underline ml-4 cursor-pointer">
              Reintentar
            </button>
          </div>
        )}

        {/* Tabla */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "var(--parchment)",
            border: "1px solid var(--border-warm)",
            boxShadow: "0 1px 4px rgba(17,23,20,0.05)",
          }}
          role="region"
          aria-label="Lista de consultas"
        >

          {/* Skeleton loading */}
          {loading && (
            <div className="p-6 space-y-4" aria-label="Cargando consultas" aria-busy="true">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-4">
                  <div className="skeleton h-5 flex-[2]" />
                  <div className="skeleton h-5 flex-1" />
                  <div className="skeleton h-5 flex-1" />
                  <div className="skeleton h-5 w-20" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {estaVacio && (
            <div className="flex flex-col items-center gap-5 py-16 text-center px-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: "var(--forest-50)", border: "1px solid var(--forest-100)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--forest-400)" strokeWidth="1.5" aria-hidden="true">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  <rect x="8" y="2" width="8" height="4" rx="1"/>
                  <path d="M9 12h6M9 16h4"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold" style={{ color: "var(--ink)" }}>
                  {estadoFiltro || fechaFiltro ? "Sin resultados para estos filtros" : "Sin consultas registradas"}
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--stone)" }}>
                  {!estadoFiltro && !fechaFiltro && "Inicia una nueva consulta para comenzar."}
                </p>
              </div>
              {!estadoFiltro && !fechaFiltro && (
                <Link
                  href="/consulta/nueva"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
                  style={{
                    background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-600) 100%)",
                    color: "#fff",
                    boxShadow: "0 2px 8px rgba(28,61,47,0.2)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Nueva consulta
                </Link>
              )}
            </div>
          )}

          {/* Table */}
          {tieneResultados && (
            <table className="w-full text-sm" role="table" aria-label="Consultas">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-warm)", backgroundColor: "rgba(228,221,211,0.3)" }}>
                  <th scope="col" className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--stone)" }}>Paciente</th>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--stone)" }}>Estado</th>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--stone)" }}>Fecha</th>
                  <th scope="col" className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--stone)" }}>Duración</th>
                  <th scope="col" className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--stone)" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c, idx) => (
                  <tr
                    key={c.id}
                    style={{
                      borderBottom: idx < items.length - 1 ? "1px solid var(--border-warm)" : undefined,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(240,237,231,0.5)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                  >
                    <td className="px-5 py-3.5">
                      {c.paciente_id ? (
                        <Link
                          href={`/paciente/${c.paciente_id}`}
                          className="font-semibold hover:underline underline-offset-2 transition-colors"
                          style={{ color: "var(--forest-700)" }}
                          onClick={e => e.stopPropagation()}
                        >
                          {c.paciente_nombre}
                        </Link>
                      ) : (
                        <p className="font-semibold" style={{ color: "var(--ink)" }}>{c.paciente_nombre}</p>
                      )}
                      <p
                        className="text-xs font-mono mt-0.5 truncate max-w-[160px]"
                        style={{ color: "var(--stone)" }}
                      >
                        {c.id.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge estado={c.estado} /></td>
                    <td className="px-4 py-3.5 text-xs tabular-nums whitespace-nowrap" style={{ color: "var(--stone)" }}>
                      {formatFecha(c.fecha)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs tabular-nums" style={{ color: "var(--stone)" }}>
                      {formatDuracion(c.duracion_segundos)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {["listo", "generando", "pendiente", "revisada", "validada"].includes(c.estado) && (
                          <Link
                            href={`/consulta/${c.id}`}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                            style={{
                              border: "1px solid var(--border-warm)",
                              color: "var(--stone)",
                              backgroundColor: "transparent",
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--cream)"; (e.currentTarget as HTMLElement).style.color = "var(--ink)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--stone)"; }}
                          >
                            Transcripción
                          </Link>
                        )}
                        {c.estado === "listo" && (
                          <Link
                            href={`/consulta/${c.id}/historia`}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                            style={{
                              background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-600) 100%)",
                              color: "#fff",
                              boxShadow: "0 1px 4px rgba(28,61,47,0.2)",
                            }}
                          >
                            Generar HC
                          </Link>
                        )}
                        {["generando", "pendiente", "revisada"].includes(c.estado) && (
                          <Link
                            href={`/consulta/${c.id}/historia`}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
                            style={{
                              border: "1px solid var(--forest-200)",
                              color: "var(--forest-800)",
                              backgroundColor: "var(--forest-50)",
                            }}
                          >
                            Ver historia
                          </Link>
                        )}
                        {c.estado === "validada" && (
                          <Link
                            href={`/consulta/${c.id}/historia`}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
                            style={{
                              border: "1px solid var(--forest-200)",
                              color: "var(--forest-800)",
                              backgroundColor: "var(--forest-50)",
                            }}
                          >
                            Validada
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

        {/* Paginación */}
        {result && result.pages > 1 && (
          <nav className="flex items-center justify-center gap-2" aria-label="Paginación">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{
                border: "1px solid var(--border-warm)",
                backgroundColor: "var(--parchment)",
                color: "var(--ink)",
              }}
            >
              ← Anterior
            </button>
            <span className="text-sm px-2 tabular-nums" style={{ color: "var(--stone)" }}>
              {result.page} / {result.pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(result.pages, p + 1))}
              disabled={page === result.pages}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={{
                border: "1px solid var(--border-warm)",
                backgroundColor: "var(--parchment)",
                color: "var(--ink)",
              }}
            >
              Siguiente →
            </button>
          </nav>
        )}
      </div>
    </AppShell>
  );
}
