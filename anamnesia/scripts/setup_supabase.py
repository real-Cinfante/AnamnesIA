"""
Script de setup inicial de Supabase.
Crea las 3 tablas del schema de AnamnesIA si no existen.

Uso:
    cd anamnesia
    source venv/bin/activate
    python scripts/setup_supabase.py
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL y SUPABASE_KEY deben estar en .env")
    sys.exit(1)

from supabase import create_client

db = create_client(SUPABASE_URL, SUPABASE_KEY)

SCHEMA_SQL = """
-- Pacientes
CREATE TABLE IF NOT EXISTS pacientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rut TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    fecha_nacimiento DATE,
    sexo TEXT,
    telefono TEXT,
    email TEXT,
    perfil_clinico JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Consultas
CREATE TABLE IF NOT EXISTS consultas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    medico_id TEXT NOT NULL,
    paciente_nombre TEXT NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
    estado TEXT NOT NULL DEFAULT 'grabando',
    audio_path TEXT,
    duracion_segundos INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vincular consultas con pacientes
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS paciente_id UUID REFERENCES pacientes(id);

-- Segmentos de transcripción
CREATE TABLE IF NOT EXISTS segmentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id UUID REFERENCES consultas(id) ON DELETE CASCADE,
    hablante TEXT NOT NULL,
    texto TEXT NOT NULL,
    inicio_segundos FLOAT NOT NULL,
    fin_segundos FLOAT NOT NULL,
    orden INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Historias clínicas
CREATE TABLE IF NOT EXISTS historias_clinicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id UUID REFERENCES consultas(id) ON DELETE CASCADE,
    anamnesis TEXT,
    antecedentes TEXT,
    examen_fisico TEXT,
    diagnostico_presuntivo TEXT,
    indicaciones TEXT,
    estado TEXT DEFAULT 'borrador',
    editada_por_medico BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── RLS policies ───────────────────────────────────────────────────────────────
-- Ejecutar DESPUÉS de crear las tablas

ALTER TABLE consultas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medico_solo_sus_consultas" ON consultas;
CREATE POLICY "medico_solo_sus_consultas" ON consultas
  USING (auth.uid()::text = medico_id);

ALTER TABLE segmentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medico_solo_sus_segmentos" ON segmentos;
CREATE POLICY "medico_solo_sus_segmentos" ON segmentos
  USING (consulta_id IN (
    SELECT id FROM consultas WHERE medico_id = auth.uid()::text
  ));

ALTER TABLE historias_clinicas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medico_solo_sus_historias" ON historias_clinicas;
CREATE POLICY "medico_solo_sus_historias" ON historias_clinicas
  USING (consulta_id IN (
    SELECT id FROM consultas WHERE medico_id = auth.uid()::text
  ));
"""

# Supabase REST API no ejecuta SQL arbitrario — se debe usar el SQL editor
# del dashboard o la extensión pg (postgres directo).
# Este script imprime las instrucciones y el SQL para copiar/pegar.

print("=" * 60)
print("AnamnesIA — Setup de Supabase")
print("=" * 60)
print()
print("La API REST de Supabase no permite ejecutar DDL directamente.")
print("Copia el siguiente SQL en el SQL Editor de tu proyecto Supabase:")
print("  https://supabase.com/dashboard/project/_/sql/new")
print()
print("─" * 60)
print(SCHEMA_SQL)
print("─" * 60)
print()

# Verificar conexión listando tablas existentes
try:
    res = db.table("pacientes").select("id").limit(1).execute()
    print("✓ Tabla 'pacientes' encontrada y accesible.")
except Exception:
    print("⚠  Tabla 'pacientes' aún no existe — ejecuta el SQL de arriba primero.")

try:
    res = db.table("consultas").select("id").limit(1).execute()
    print("✓ Tabla 'consultas' encontrada y accesible.")
except Exception:
    print("⚠  Tabla 'consultas' aún no existe — ejecuta el SQL de arriba primero.")

try:
    res = db.table("segmentos").select("id").limit(1).execute()
    print("✓ Tabla 'segmentos' encontrada y accesible.")
except Exception:
    print("⚠  Tabla 'segmentos' aún no existe.")

try:
    res = db.table("historias_clinicas").select("id").limit(1).execute()
    print("✓ Tabla 'historias_clinicas' encontrada y accesible.")
except Exception:
    print("⚠  Tabla 'historias_clinicas' aún no existe.")

print()
print("Setup completo.")
