import { createClient } from "./supabase";
import type { Consulta, Segmento, HistoriaClinica, ApiOk } from "./types";

// Todas las llamadas van por el proxy de Next.js (/api/backend/api/...)
// El cliente incluye el JWT en Authorization para que el proxy lo reenvíe al backend.
const PROXY = "/api/backend";

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
  } catch {
    // sin sesión activa
  }
  return {};
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${PROXY}/api${path}`;

  const isFormData = options.body instanceof FormData;
  const baseHeaders: Record<string, string> = isFormData
    ? {}
    : { "Content-Type": "application/json" };

  const authHeader = await getAuthHeader();

  const res = await fetch(url, {
    ...options,
    headers: {
      ...baseHeaders,
      ...authHeader,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }

  return (json as ApiOk<T>).data;
}

// ── Consultas ──────────────────────────────────────────────────────────────────

export const consultas = {
  list: () =>
    request<{ items: Consulta[]; total: number; page: number; per_page: number; pages: number }>(`/consultas/`),

  get: (id: string) =>
    request<Consulta>(`/consultas/${id}`),

  update: (id: string, payload: Partial<Consulta>) =>
    request<Consulta>(`/consultas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    request<void>(`/consultas/${id}`, { method: "DELETE" }),

  segmentos: (id: string) =>
    request<Segmento[]>(`/consultas/${id}/segmentos`),

  stats: () =>
    request<{ total: number; pendientes_validar: number; validadas_hoy: number }>(`/consultas/stats`),
};

// ── Audio ──────────────────────────────────────────────────────────────────────

export const audio = {
  subir: (consultaId: string, file: File, tipo: "consulta" | "examen" = "consulta") => {
    const form = new FormData();
    form.append("audio", file);
    return request<{ audio_path: string }>(
      `/audio/subir/${consultaId}?tipo=${tipo}`,
      { method: "POST", body: form }
    );
  },
};

// ── Pacientes ──────────────────────────────────────────────────────────────────

export const pacientes = {
  list: (q?: string) =>
    request<{ id: string; rut: string; nombre: string; perfil_clinico: Record<string, unknown> }[]>(
      `/pacientes/${q ? `?q=${encodeURIComponent(q)}` : ""}`
    ),

  get: (id: string) =>
    request<{ id: string; rut: string; nombre: string; perfil_clinico: Record<string, unknown> }>(`/pacientes/${id}`),

  crear: (payload: { rut: string; nombre: string; fecha_nacimiento?: string; sexo?: string }) =>
    request<{ id: string; rut: string; nombre: string }>("/pacientes/", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

// ── Historias ──────────────────────────────────────────────────────────────────

export const historias = {
  get: (consultaId: string) =>
    request<HistoriaClinica>(`/historias/${consultaId}`),

  generar: (consultaId: string) =>
    request<HistoriaClinica>(`/historias/generar/${consultaId}`, { method: "POST" }),

  update: (historiaId: string, payload: Partial<HistoriaClinica>) =>
    request<HistoriaClinica>(`/historias/${historiaId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
