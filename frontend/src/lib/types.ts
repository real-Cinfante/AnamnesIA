// ── Consulta ───────────────────────────────────────────────────────────────────

export type ConsultaEstado =
  | "grabando"
  | "transcribiendo"
  | "generando"
  | "listo"
  | "error";

export interface Consulta {
  id: string;
  medico_id: string;
  paciente_nombre: string;
  paciente_id?: string | null;
  fecha: string;               // ISO 8601
  estado: ConsultaEstado;
  audio_path: string | null;
  duracion_segundos: number | null;
  created_at: string;
  updated_at: string;
}

// ── Segmento ───────────────────────────────────────────────────────────────────

export type Hablante = "medico" | "paciente" | "medico_examen" | "sin_clasificar";

export interface Segmento {
  id?: string;            // presente en Supabase, ausente en store en memoria
  consulta_id?: string;
  hablante: Hablante;
  texto: string;
  inicio_segundos: number;
  fin_segundos: number;
  orden: number;
  created_at?: string;
}

// ── Transcripción (respuesta del endpoint /transcripcion) ──────────────────────

export type TranscripcionEstado = "transcribiendo" | "listo" | "error";

export interface Transcripcion {
  consulta_id: string;
  estado: TranscripcionEstado;
  audio_url: string | null;
  segmentos: Segmento[];
  error: string | null;
}

// ── Historia Clínica ───────────────────────────────────────────────────────────

export type HistoriaEstado = "borrador" | "revisada" | "validada";

// "generando" y "error" solo aparecen durante el pipeline, no son estados finales editables
export type HistoriaPipelineEstado = HistoriaEstado | "generando" | "error";

export interface HistoriaClinica {
  id: string | null;
  consulta_id: string;
  anamnesis: string;
  antecedentes: string;
  examen_fisico: string;
  diagnostico_presuntivo: string;
  indicaciones: string;
  estado: HistoriaPipelineEstado;
  editada_por_medico: boolean;
  validated_at: string | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ── Paciente ───────────────────────────────────────────────────────────────────

export interface PerfilClinico {
  condiciones_activas: string[];
  condiciones_resueltas: string[];
  medicamentos_actuales: { nombre: string; dosis: string; desde: string }[];
  alergias: string[];
  antecedentes_quirurgicos: string[];
  antecedentes_familiares: string[];
  habitos: Record<string, string>;
  ultima_actualizacion: string | null;
  consultas_procesadas: number;
}

export interface Paciente {
  id: string;
  rut: string;
  nombre: string;
  fecha_nacimiento: string | null;
  sexo: string | null;
  telefono: string | null;
  email: string | null;
  perfil_clinico: PerfilClinico;
  created_at: string;
  updated_at: string;
}

// ── API response wrapper ───────────────────────────────────────────────────────

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  error: string;
}

export type ApiResponse<T> = ApiOk<T> | ApiError;
