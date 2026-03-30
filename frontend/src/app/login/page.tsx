"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message === "Invalid login credentials"
        ? "Credenciales incorrectas"
        : authError.message);
      setLoading(false);
      return;
    }

    // Guardar token en cookie accesible para api.ts
    if (data.session?.access_token) {
      document.cookie = `anamnesia_token=${data.session.access_token}; path=/; samesite=lax; max-age=3600`;
    }

    // Forzar recarga completa para que el middleware lea el cookie de sesión
    window.location.assign("/consultas");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: "var(--cream)" }}
    >
      <div className="w-full max-w-sm px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: "var(--forest-800)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4EA87D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/>
              <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/>
              <circle cx="20" cy="10" r="2"/>
            </svg>
          </div>
          <h1
            className="font-display text-2xl tracking-tight"
            style={{ color: "var(--ink)" }}
          >
            AnamnesIA
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--stone)" }}>
            Inicia sesión para continuar
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6"
          style={{
            backgroundColor: "#fff",
            border: "1px solid var(--border-warm)",
            boxShadow: "0 1px 3px rgba(26,107,90,0.08)",
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dr.nombre@clinica.com"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  border: "1px solid var(--border-warm)",
                  backgroundColor: "var(--cream)",
                  color: "var(--ink)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--forest-400)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-warm)")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-sm font-medium"
                style={{ color: "var(--ink)" }}
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{
                  border: "1px solid var(--border-warm)",
                  backgroundColor: "var(--cream)",
                  color: "var(--ink)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--forest-400)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-warm)")}
              />
            </div>

            {error && (
              <p
                className="text-sm px-3.5 py-2.5 rounded-xl"
                style={{
                  color: "#b91c1c",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg, var(--forest-800) 0%, var(--forest-600) 100%)",
                color: "#fff",
              }}
            >
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
