"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconClipboard({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1"/>
      <path d="M9 12h6M9 16h4"/>
    </svg>
  );
}

function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  );
}

function IconUsers({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="7" r="4"/>
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      <path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
    </svg>
  );
}

function IconStethoscope({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
      <circle cx="20" cy="10" r="2"/>
    </svg>
  );
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV = [
  {
    href:  "/consultas",
    label: "Consultas",
    icon:  IconClipboard,
    exact: false,
  },
  {
    href:  "/pacientes",
    label: "Pacientes",
    icon:  IconUsers,
    exact: false,
  },
  {
    href:  "/consulta/nueva",
    label: "Nueva consulta",
    icon:  IconPlus,
    exact: false,
  },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const { createClient } = await import("@/lib/supabase");
        const supabase = createClient();
        // Obtener sesión y refrescar cookie del token
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          document.cookie = `anamnesia_token=${session.access_token}; path=/; samesite=lax; max-age=3600`;
          setUserEmail(session.user?.email ?? null);
        }
        // Listener para refrescos de token
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
          if (s?.access_token) {
            document.cookie = `anamnesia_token=${s.access_token}; path=/; samesite=lax; max-age=3600`;
            setUserEmail(s.user?.email ?? null);
          }
        });
        return () => subscription.unsubscribe();
      } catch {
        // Supabase not configured
      }
    }
    loadUser();
  }, []);

  async function handleLogout() {
    try {
      const { createClient } = await import("@/lib/supabase");
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    if (href === "/consultas") return pathname === "/consultas" || (pathname.startsWith("/consulta/") && !pathname.endsWith("/nueva"));
    if (href === "/pacientes") return pathname === "/pacientes" || pathname.startsWith("/paciente/");
    return pathname.startsWith(href);
  }

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[240px] flex flex-col z-40"
      style={{ backgroundColor: "var(--forest-950)" }}
      role="navigation"
      aria-label="Navegación principal"
    >
      {/* Logo */}
      <Link
        href="/"
        className="flex items-center gap-3 px-5 h-16 flex-shrink-0 transition-opacity hover:opacity-80"
        style={{ borderBottom: "1px solid rgba(78,168,125,0.12)" }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
          style={{ backgroundColor: "var(--forest-800)", border: "1px solid rgba(78,168,125,0.2)" }}
        >
          <span style={{ color: "var(--forest-400)" }}>
            <IconStethoscope size={16} />
          </span>
        </div>
        <span
          className="font-display text-[17px] tracking-tight"
          style={{ color: "#fff" }}
        >
          AnamnesIA
        </span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 flex flex-col gap-0.5" aria-label="Secciones">
        <p
          className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "rgba(149,214,184,0.4)" }}
        >
          Menú
        </p>

        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="relative flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-[13.5px] font-medium transition-all duration-150"
              style={{
                color: active ? "#fff" : "rgba(149,214,184,0.65)",
                backgroundColor: active ? "rgba(78,168,125,0.12)" : "transparent",
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(78,168,125,0.07)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(149,214,184,0.9)";
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "rgba(149,214,184,0.65)";
                }
              }}
            >
              {/* Active indicator */}
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ backgroundColor: "var(--forest-400)" }}
                  aria-hidden="true"
                />
              )}

              <span style={{ color: active ? "var(--forest-400)" : "rgba(149,214,184,0.5)" }}>
                <Icon size={15} />
              </span>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: user + logout */}
      <div
        className="px-4 py-4 flex-shrink-0 flex flex-col gap-2"
        style={{ borderTop: "1px solid rgba(78,168,125,0.08)" }}
      >
        {userEmail && (
          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
            style={{ backgroundColor: "rgba(78,168,125,0.06)" }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
              style={{ backgroundColor: "var(--forest-800)", color: "var(--forest-400)" }}
            >
              {userEmail[0].toUpperCase()}
            </div>
            <p
              className="text-[11px] truncate flex-1"
              style={{ color: "rgba(149,214,184,0.6)" }}
            >
              {userEmail}
            </p>
          </div>
        )}

        {userEmail && (
          <button
            onClick={handleLogout}
            className="w-full text-left px-2 py-1.5 rounded-lg text-[12px] transition-all duration-150 flex items-center gap-2"
            style={{ color: "rgba(149,214,184,0.45)" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = "rgba(149,214,184,0.8)";
              (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(78,168,125,0.07)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = "rgba(149,214,184,0.45)";
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        )}

        <p
          className="text-[10px] font-mono px-2"
          style={{ color: "rgba(149,214,184,0.2)" }}
        >
          v0.1.0 · MVP
        </p>
      </div>
    </aside>
  );
}
