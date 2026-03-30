"use client";

export const dynamic = "force-dynamic";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { formatearRut } from "@/lib/rut";
import { pacientes as pacientesApi } from "@/lib/api";
import type { Paciente } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(nombre: string) {
  return nombre.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        className="rounded-sm font-semibold not-italic"
        style={{ backgroundColor: "var(--forest-100)", color: "var(--forest-800)" }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── PacienteCard ─────────────────────────────────────────────────────────────

function PacienteCard({ p, query }: { p: Paciente; query: string }) {
  const condiciones = p.perfil_clinico?.condiciones_activas ?? [];
  return (
    <Link
      href={`/paciente/${p.id}`}
      className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-150 group"
      style={{
        backgroundColor: "var(--parchment)",
        border: "1px solid var(--border-warm)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--forest-200)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(28,61,47,0.09)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-warm)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
        style={{ backgroundColor: "var(--forest-100)", color: "var(--forest-800)" }}
      >
        {initials(p.nombre)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" style={{ color: "var(--ink)" }}>
          <Highlight text={p.nombre} query={query} />
        </p>
        <p className="text-xs font-mono mt-0.5" style={{ color: "var(--stone)" }}>
          <Highlight text={formatearRut(p.rut)} query={query} />
        </p>
      </div>

      {condiciones.length > 0 && (
        <div className="hidden sm:flex flex-wrap gap-1.5 max-w-[220px]">
          {condiciones.slice(0, 2).map((c, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full text-xs"
              style={{
                backgroundColor: "var(--forest-50)",
                color: "var(--forest-700)",
                border: "1px solid var(--forest-100)",
              }}
            >
              {c}
            </span>
          ))}
          {condiciones.length > 2 && (
            <span className="px-2 py-0.5 rounded-full text-xs" style={{ color: "var(--stone)" }}>
              +{condiciones.length - 2}
            </span>
          )}
        </div>
      )}

      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="var(--stone)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden="true"
      >
        <path d="M9 18l6-6-6-6"/>
      </svg>
    </Link>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PacientesPage() {
  const [query, setQuery]               = useState("");
  const [todos, setTodos]               = useState<Paciente[]>([]);
  const [sugerencias, setSugerencias]   = useState<Paciente[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const inputRef                        = useRef<HTMLInputElement>(null);
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga inicial
  useEffect(() => {
    pacientesApi.list()
      .then(data => setTodos(data as unknown as Paciente[]))
      .catch(() => setError("No se pudieron cargar los pacientes"))
      .finally(() => setLoading(false));
  }, []);

  // Sugerencias con debounce — filtrado local
  const actualizarSugerencias = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSugerencias([]); setDropdownOpen(false); return; }
    debounceRef.current = setTimeout(() => {
      const lower = q.toLowerCase();
      const rutQ  = q.replace(/\./g, "").replace(/-/g, "").toLowerCase();
      const hits  = todos.filter(p =>
        p.nombre.toLowerCase().includes(lower) ||
        p.rut.replace(/\./g, "").replace(/-/g, "").toLowerCase().includes(rutQ)
      ).slice(0, 6);
      setSugerencias(hits);
      setDropdownOpen(true);
    }, 150);
  }, [todos]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    actualizarSugerencias(val);
  };

  const handleClear = () => {
    setQuery("");
    setSugerencias([]);
    setDropdownOpen(false);
    inputRef.current?.focus();
  };

  const handleSugerenciaSelect = (p: Paciente) => {
    setQuery(p.nombre);
    setDropdownOpen(false);
  };

  // Lista filtrada
  const lista = query.trim()
    ? todos.filter(p => {
        const lower = query.toLowerCase();
        const rutQ  = query.replace(/\./g, "").replace(/-/g, "").toLowerCase();
        return (
          p.nombre.toLowerCase().includes(lower) ||
          p.rut.replace(/\./g, "").replace(/-/g, "").toLowerCase().includes(rutQ)
        );
      })
    : todos;

  return (
    <AppShell>
      <div className="flex flex-col gap-7 animate-fade-in max-w-3xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-tight" style={{ color: "var(--ink)" }}>
              Pacientes
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--stone)" }}>
              {loading
                ? "Cargando…"
                : `${todos.length} paciente${todos.length !== 1 ? "s" : ""} registrado${todos.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link
            href="/consulta/nueva"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold flex-shrink-0 transition-all"
            style={{
              background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-600) 100%)",
              color: "#fff",
              boxShadow: "0 2px 10px rgba(28,61,47,0.2)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nueva consulta
          </Link>
        </div>

        {/* Buscador */}
        <div className="relative">
          <div
            className="flex items-center gap-3 px-4 rounded-xl transition-all"
            style={{ border: "1.5px solid var(--border-warm)", backgroundColor: "#fff" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--stone)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleChange}
              onFocus={e => {
                e.currentTarget.parentElement!.style.borderColor = "var(--forest-400)";
                e.currentTarget.parentElement!.style.boxShadow = "0 0 0 3px rgba(78,168,125,0.1)";
                if (query && sugerencias.length) setDropdownOpen(true);
              }}
              onBlur={e => {
                e.currentTarget.parentElement!.style.borderColor = "var(--border-warm)";
                e.currentTarget.parentElement!.style.boxShadow = "none";
                setTimeout(() => setDropdownOpen(false), 150);
              }}
              placeholder="Buscar por nombre o RUT…"
              autoComplete="off"
              className="flex-1 py-3 text-sm bg-transparent outline-none"
              style={{ color: "var(--ink)" }}
              aria-label="Buscar paciente"
            />
            {query && (
              <button
                onClick={handleClear}
                className="flex-shrink-0 p-0.5 rounded-full transition-opacity hover:opacity-70"
                style={{ color: "var(--stone)" }}
                aria-label="Limpiar búsqueda"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>

          {/* Dropdown sugerencias */}
          {dropdownOpen && sugerencias.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-20"
              style={{
                backgroundColor: "#fff",
                border: "1px solid var(--border-warm)",
                boxShadow: "0 8px 24px rgba(17,23,20,0.12)",
              }}
              role="listbox"
            >
              {sugerencias.map((p, idx) => (
                <button
                  key={p.id}
                  onMouseDown={() => handleSugerenciaSelect(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{
                    borderBottom: idx < sugerencias.length - 1 ? "1px solid var(--border-warm)" : "none",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = "var(--cream)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"}
                  role="option"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ backgroundColor: "var(--forest-100)", color: "var(--forest-800)" }}
                  >
                    {initials(p.nombre)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
                      <Highlight text={p.nombre} query={query} />
                    </p>
                    <p className="text-xs font-mono" style={{ color: "var(--stone)" }}>
                      <Highlight text={formatearRut(p.rut)} query={query} />
                    </p>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--stone)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
            {error}
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="h-[68px] rounded-2xl animate-pulse"
                style={{ backgroundColor: "var(--parchment)", border: "1px solid var(--border-warm)" }}
              />
            ))}
          </div>
        ) : lista.length > 0 ? (
          <div className="flex flex-col gap-2.5">
            {query.trim() && (
              <p className="text-xs" style={{ color: "var(--stone)" }}>
                {lista.length} resultado{lista.length !== 1 ? "s" : ""} para{" "}
                <span className="font-semibold" style={{ color: "var(--ink)" }}>&ldquo;{query}&rdquo;</span>
              </p>
            )}
            {lista.map(p => <PacienteCard key={p.id} p={p} query={query} />)}
          </div>
        ) : (
          <div
            className="rounded-2xl flex flex-col items-center gap-4 py-16 text-center"
            style={{ backgroundColor: "var(--parchment)", border: "1px solid var(--border-warm)" }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: "var(--forest-50)", border: "1px solid var(--forest-100)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--forest-400)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold" style={{ color: "var(--ink)" }}>
                {query.trim() ? `Sin resultados para "${query}"` : "Aún no hay pacientes registrados"}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--stone)" }}>
                {query.trim()
                  ? "Prueba con otro nombre o RUT."
                  : "Los pacientes aparecen aquí al crear la primera consulta."}
              </p>
            </div>
            {!query.trim() && (
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
      </div>
    </AppShell>
  );
}
