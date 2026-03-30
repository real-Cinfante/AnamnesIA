# AnamnesIA — Contexto de proyecto para Claude Code

Asistente de documentación clínica. Graba el audio de una consulta médica,
transcribe diferenciando médico y paciente, y genera automáticamente una historia
clínica estructurada lista para revisión del médico.

---

## Stack

- **Backend**: Python 3 + Flask (API REST, puerto 5001)
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Base de datos**: Supabase (PostgreSQL cloud)
- **Transcripción**: Whisper open source (local), modelo `large-v3` en producción,
  `medium` en desarrollo para mayor velocidad
- **IA**: Anthropic SDK (Claude) para generación de historia clínica
- **Deploy**: Railway (backend) + Vercel (frontend) + Supabase (DB)

---

## Estructura de directorios

```
anamnesia/
├── app/
│   ├── __init__.py           # App factory: Flask, blueprints, CORS, middleware API key
│   ├── config.py             # Env vars: Anthropic, Supabase, Whisper config
│   ├── models/
│   │   ├── consulta.py       # Dataclass Consulta con to_dict()
│   │   ├── transcripcion.py  # Dataclass Segmento (hablante, texto, timestamps)
│   │   └── historia.py       # Dataclass HistoriaClinica con to_dict()
│   ├── routes/
│   │   ├── consultas.py      # CRUD de consultas
│   │   ├── transcripcion.py  # POST /transcribir — recibe audio, devuelve guion
│   │   └── historia.py       # POST /generar-historia — recibe guion, devuelve HC
│   └── services/
│       ├── supabase_service.py   # Toda la lógica de DB
│       ├── whisper_service.py    # Carga modelo, transcribe, devuelve segmentos
│       └── historia_service.py   # Llama a Claude para generar historia clínica
├── run.py
└── scripts/
    └── setup_supabase.py     # Crea tablas: consultas, segmentos, historias

frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                        # Dashboard: lista de consultas
│   │   ├── consulta/
│   │   │   ├── nueva/page.tsx              # Grabación de audio
│   │   │   └── [id]/
│   │   │       ├── transcripcion/page.tsx  # Guion estructurado con audio vinculado
│   │   │       └── historia/page.tsx       # Historia clínica generada + editor
│   │   └── api/
│   │       └── backend/
│   │           └── [...path]/route.ts      # Proxy a Flask
│   ├── components/
│   │   ├── sidebar.tsx
│   │   ├── grabador-audio.tsx              # Grabación con waveform animado
│   │   ├── guion-viewer.tsx                # Segmentos por hablante + timestamps clickeables
│   │   └── historia-editor.tsx             # Editor de historia clínica con validación
│   └── lib/
│       ├── api.ts
│       └── types.ts
```

---

## Modelos de datos

### Consulta
```python
@dataclass
class Consulta:
    id: str                  # UUID
    medico_id: str
    paciente_nombre: str
    fecha: str               # ISO 8601
    estado: str              # "grabando" | "transcribiendo" | "generando" | "listo" | "error"
    audio_path: str          # Ruta local al archivo de audio
    duracion_segundos: int
    created_at: str
    updated_at: str
```

### Segmento (unidad del guion)
```python
@dataclass
class Segmento:
    id: str
    consulta_id: str
    hablante: str            # "medico" | "paciente" | "medico_examen"
    texto: str
    inicio_segundos: float
    fin_segundos: float
    orden: int
```

### HistoriaClinica
```python
@dataclass
class HistoriaClinica:
    id: str
    consulta_id: str
    anamnesis: str
    antecedentes: str
    examen_fisico: str
    diagnostico_presuntivo: str
    indicaciones: str
    estado: str              # "borrador" | "revisada" | "validada"
    editada_por_medico: bool
    created_at: str
    updated_at: str
```

---

## Schema Supabase

```sql
CREATE TABLE consultas (
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

CREATE TABLE segmentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consulta_id UUID REFERENCES consultas(id) ON DELETE CASCADE,
    hablante TEXT NOT NULL,
    texto TEXT NOT NULL,
    inicio_segundos FLOAT NOT NULL,
    fin_segundos FLOAT NOT NULL,
    orden INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE historias_clinicas (
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
```

---

## Whisper Service (open source local)

```python
# services/whisper_service.py
import whisper
import os

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "medium")

_model = None

def get_model():
    global _model
    if _model is None:
        _model = whisper.load_model(WHISPER_MODEL)
    return _model

def transcribir_audio(audio_path: str) -> list[dict]:
    """
    Transcribe audio y devuelve segmentos con timestamps.
    Nota v1: Whisper open source no hace diarización nativa.
    Los segmentos del audio principal se marcan 'sin_clasificar'.
    Los del audio de examen físico se marcan 'medico_examen'.
    """
    model = get_model()
    result = model.transcribe(
        audio_path,
        language="es",
        verbose=False
    )

    segmentos = []
    for i, seg in enumerate(result["segments"]):
        segmentos.append({
            "texto": seg["text"].strip(),
            "inicio_segundos": seg["start"],
            "fin_segundos": seg["end"],
            "hablante": "sin_clasificar",
            "orden": i
        })

    return segmentos
```

**Diarización en v1:** No nativa en Whisper open source. Estrategia MVP:
- Consulta principal: segmentos marcados como `sin_clasificar`
- Examen físico (audio separado): segmentos marcados como `medico_examen`
- Claude infiere médico/paciente en la generación de historia clínica
- v2: integrar `pyannote-audio` para diarización real

---

## Historia Service (Claude)

```python
# services/historia_service.py
import anthropic
import json

client = anthropic.Anthropic()

SYSTEM_PROMPT = """Eres un asistente de documentación clínica médica.
Genera historias clínicas estructuradas a partir de transcripciones de consultas.
Usa terminología médica apropiada. No inventes información ausente en la transcripción.
Responde SOLO con JSON válido, sin markdown ni texto adicional."""

def generar_historia(segmentos: list[dict]) -> dict:
    guion = "\n".join([
        f"[{s['hablante'].upper()} | {s['inicio_segundos']:.1f}s] {s['texto']}"
        for s in segmentos
    ])

    prompt = f"""Genera una historia clínica a partir de esta transcripción:

{guion}

Devuelve JSON con exactamente estas claves:
- anamnesis: motivo de consulta y síntomas relatados
- antecedentes: antecedentes relevantes mencionados
- examen_fisico: hallazgos del examen físico
- diagnostico_presuntivo: hipótesis diagnóstica
- indicaciones: tratamiento, indicaciones o derivaciones
"""

    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}]
    )

    return json.loads(response.content[0].text)
```

---

## Autenticación (Supabase Auth + RLS)

### Principios
- Auth manejada 100% por Supabase Auth (email + password)
- JWT validado en el backend en cada request
- medico_id NUNCA viene del body — siempre se extrae del JWT verificado
- RLS activo en todas las tablas para garantizar aislamiento de datos a nivel DB

### Backend
- Middleware Flask que valida JWT de Supabase en cada request protegido
- Extrae medico_id del token y lo inyecta al contexto de la request
- Rutas públicas: solo GET /api/health
- Todas las demás rutas requieren Authorization: Bearer <token>

### Frontend
- Supabase client con @supabase/ssr para manejo de sesión server-side
- Middleware de Next.js: redirige a /login si no hay sesión activa
- /login/page.tsx: formulario email + password
- JWT se adjunta automáticamente en cada llamada al backend via api.ts
- Al hacer logout, limpiar sesión y redirigir a /login

### Base de datos — RLS policies
Habilitar RLS en: consultas, segmentos, historias_clinicas

```sql
-- consultas
ALTER TABLE consultas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medico_solo_sus_consultas" ON consultas
  USING (auth.uid()::text = medico_id);

-- segmentos (acceso via consulta del médico)
ALTER TABLE segmentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medico_solo_sus_segmentos" ON segmentos
  USING (consulta_id IN (
    SELECT id FROM consultas WHERE medico_id = auth.uid()::text
  ));

-- historias_clinicas (acceso via consulta del médico)
ALTER TABLE historias_clinicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medico_solo_sus_historias" ON historias_clinicas
  USING (consulta_id IN (
    SELECT id FROM consultas WHERE medico_id = auth.uid()::text
  ));
```

### Variables de entorno adicionales
```
# Backend
SUPABASE_JWT_SECRET=    # Settings → API → JWT Settings → JWT Secret

# Frontend
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

---

## Patrones de arquitectura

### 1. Service Layer
Toda la lógica de negocio en `/app/services/`. Routes solo validan y llaman al service.
Nunca DB access directo en routes.

### 2. Respuesta de API consistente
```python
return jsonify({"ok": True, "data": result}), 200
return jsonify({"error": "mensaje legible"}), 400/404/500
```

### 3. Proxy de API
- Dev: frontend llama directo a Flask en `NEXT_PUBLIC_API_URL`
- Prod: proxy Next.js agrega `X-API-Key`, nunca expuesto al browser

### 4. Estado como máquina de estados
```
grabando → transcribiendo → generando → listo
                                      ↘ error
```
Frontend hace polling cada 2s sobre `GET /api/consultas/:id` para mostrar progreso.

### 5. Middleware API Key
```python
@app.before_request
def check_api_key():
    if os.getenv("BACKEND_API_KEY"):
        key = request.headers.get("X-API-Key")
        if key != os.getenv("BACKEND_API_KEY"):
            return jsonify({"error": "Unauthorized"}), 401
```

### 6. Audio storage v1
Audio guardado en filesystem local (`/tmp/anamnesia/audio/`).
Nombrar archivos con UUID para evitar colisiones.
En producción: migrar a Supabase Storage o S3.

### 7. Singleton Whisper
El modelo se carga una sola vez al primer request. Usar patrón singleton en
`whisper_service.py` para no recargar en cada llamada.

---

## Variables de entorno

### Backend (.env)
```
FLASK_SECRET_KEY=
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_KEY=
BACKEND_API_KEY=
WHISPER_MODEL=medium
AUDIO_STORAGE_PATH=/tmp/anamnesia/audio
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:5001
BACKEND_URL=
BACKEND_API_KEY=
```

---

## Sistema de diseño — AnamnesIA

Identidad: SaaS de salud moderno. Confiable, limpio, no hospitalario genérico.

```javascript
// tailwind.config.ts
colors: {
  primary: "#1a6b5a",        // Verde médico oscuro
  accent: "#34c9a0",         // Verde claro — acciones, éxito
  slate: "#1e293b",          // Texto principal
  "pale-green": "#f0faf7",   // Fondos de sección
}
backgroundImage: {
  "brand-gradient": "linear-gradient(135deg, #1a6b5a 0%, #34c9a0 100%)",
}
boxShadow: {
  card: "0 1px 3px rgba(26,107,90,0.08)",
  "card-hover": "0 4px 12px rgba(26,107,90,0.12)",
}
```

### Tipografía
```javascript
fontFamily: {
  sans: ["DM Sans", "sans-serif"],
  display: ["Fraunces", "serif"],        // Títulos — elegante, médico
  mono: ["JetBrains Mono", "monospace"], // Timestamps en el guion
}
```

### Componentes clave
- **Grabador de audio**: botón grande centrado, waveform animado, timer visible,
  estados claros (grabando / pausado / procesando)
- **Guion viewer**: médico a la izquierda, paciente a la derecha, timestamps en mono,
  click en segmento reproduce audio desde ese punto
- **Historia editor**: secciones por campo clínico, badge de estado,
  botón "Validar" prominente al terminar revisión
- **Estado chips**: grabando=gris, transcribiendo=amarillo, generando=azul,
  listo=verde, error=rojo
- **Sidebar**: fixed left, fondo slate oscuro, active state en accent verde

---

## Flujo principal

1. Dashboard con consultas del día
2. "Nueva consulta" → nombre del paciente → iniciar grabación
3. Grabación del audio de consulta (médico + paciente)
4. Opción de grabar examen físico por separado al terminar
5. "Procesar" → Whisper transcribe → segmentos guardados en Supabase
6. Frontend muestra guion con timestamps y hablantes
7. Claude genera historia clínica automáticamente
8. Médico revisa, edita si necesario, valida
9. Historia guardada y lista

---

## Setup inicial

### Backend
```bash
python3 -m venv venv
source venv/bin/activate
pip install flask flask-cors python-dotenv supabase anthropic openai-whisper
pip install torch torchvision torchaudio
mkdir -p /tmp/anamnesia/audio
python scripts/setup_supabase.py
python run.py
```

### Frontend
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

---

## Skills de diseño

- `frontend-design`: construir componentes con alto estándar visual
- `ui-ux-pro-max`: decisiones de sistema visual, paletas, dashboards

---

## Convenciones de código

- Python: snake_case, dataclasses para modelos, type hints
- TypeScript: camelCase, interfaces explícitas en `types.ts`, no `any`
- Nunca `pip install` sin activar venv
- `force-dynamic` en pages con fetch al backend
- CORS habilitado en Flask para dev local
- Whisper: singleton, cargar modelo una sola vez al iniciar servidor
- Audio: nombrar con UUID, nunca con nombre original del archivo
