"""
Servicio de historia clínica.

Store en memoria (keyed by consulta_id) como fuente primaria.
Supabase como persistencia opcional (best-effort).
"""
from __future__ import annotations

import json
import threading
import uuid
from app.config import config

# ── Store en memoria ───────────────────────────────────────────────────────────
# { consulta_id: { id, estado, anamnesis, antecedentes, examen_fisico,
#                  diagnostico_presuntivo, indicaciones,
#                  editada_por_medico, validated_at, error } }
_historias: dict[str, dict] = {}
_lock = threading.Lock()

# ── Groq client singleton ──────────────────────────────────────────────────────
_groq_client = None

SYSTEM_PROMPT = """Eres un asistente de documentación clínica médica especializado.
Generas historias clínicas estructuradas a partir de transcripciones de consultas médicas.

Reglas estrictas:
- Usa terminología médica apropiada en español.
- No inventes ni inferas información que no esté explícita en la transcripción.
- Si una sección no tiene información disponible, escribe "Sin información registrada."
- Responde SOLO con JSON válido, sin markdown, sin texto adicional, sin bloques de código."""

CAMPOS_HISTORIA = (
    "anamnesis",
    "antecedentes",
    "examen_fisico",
    "diagnostico_presuntivo",
    "indicaciones",
)

CAMPOS_EDITABLES = set(CAMPOS_HISTORIA)


def _get_groq():
    global _groq_client
    if _groq_client is None:
        from groq import Groq
        if not config.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY debe estar configurado")
        _groq_client = Groq(api_key=config.GROQ_API_KEY)
    return _groq_client


# ── Generación ─────────────────────────────────────────────────────────────────

def _llamar_llm(segmentos: list[dict]) -> dict:
    """Llama a Groq (llama-3.3-70b) y retorna el JSON de la historia clínica."""
    guion = "\n".join([
        f"[{s['hablante'].upper()} | {float(s['inicio_segundos']):.1f}s] {s['texto']}"
        for s in segmentos
    ])

    prompt = f"""Genera una historia clínica estructurada a partir de esta transcripción médica:

{guion}

Devuelve un JSON con exactamente estas claves. CADA VALOR DEBE SER UN STRING DE TEXTO PLANO (nunca objetos ni arrays):
- "anamnesis": string con motivo de consulta y síntomas relatados por el paciente
- "antecedentes": string con antecedentes médicos, quirúrgicos, familiares o farmacológicos mencionados
- "examen_fisico": string con hallazgos del examen físico realizado por el médico
- "diagnostico_presuntivo": string con hipótesis diagnóstica o diagnóstico diferencial
- "indicaciones": string con tratamiento indicado, medicamentos, dosis y derivaciones

Ejemplo de formato correcto: {"anamnesis": "Paciente refiere cefalea de 3 días...", ...}
Ejemplo INCORRECTO (NO hagas esto): {"anamnesis": {"motivo": "cefalea", "duracion": "3 días"}}
"""

    client = _get_groq()
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=2000,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content.strip())


def generar_historia_background(app, consulta_id: str) -> None:
    """Thread worker: llama a Claude, guarda resultado en store."""
    with app.app_context():
        from app.services import transcripcion_service

        print(f"\n[Historia] ▶ Generando historia — consulta={consulta_id}")
        try:
            data = transcripcion_service.get_transcripcion(consulta_id)
            if not data or not data["segmentos"]:
                raise ValueError("No hay segmentos de transcripción para esta consulta")

            campos = _llamar_llm(data["segmentos"])
            print(f"[Historia] ✓ Historia generada con {len(campos)} campos")

            _guardar_nueva(consulta_id, campos)

        except Exception as exc:
            print(f"[Historia] ✗ Error: {exc}")
            with _lock:
                entry = _historias.setdefault(consulta_id, {})
                entry["estado"] = "error"
                entry["error"] = str(exc)


def _flatten_value(val) -> str:
    """Convierte cualquier valor a string plano para campos de historia."""
    if val is None:
        return "Sin información registrada."
    if isinstance(val, str):
        return val
    if isinstance(val, dict):
        # LLM a veces devuelve sub-objetos — unir valores como texto
        parts = []
        for k, v in val.items():
            label = k.replace("_", " ").capitalize()
            if isinstance(v, list):
                v = ", ".join(str(i) for i in v)
            parts.append(f"{label}: {v}")
        return "\n".join(parts)
    if isinstance(val, list):
        return "\n".join(f"• {str(i)}" for i in val)
    return str(val)


def _guardar_nueva(consulta_id: str, campos: dict) -> dict:
    historia_id = str(uuid.uuid4())
    historia = {
        "id": historia_id,
        "consulta_id": consulta_id,
        "estado": "borrador",
        "editada_por_medico": False,
        "validated_at": None,
        "error": None,
        **{k: _flatten_value(campos.get(k)) for k in CAMPOS_HISTORIA},
    }

    with _lock:
        _historias[consulta_id] = historia

    # Persistir en Supabase (best-effort)
    try:
        from app.services import supabase_service
        supabase_service.create_historia({
            "consulta_id": consulta_id,
            **{k: historia[k] for k in CAMPOS_HISTORIA},
            "estado": "borrador",
        })
    except Exception as exc:
        print(f"[Historia] Supabase no disponible, solo en memoria: {exc}")

    return historia


# ── Lectura ────────────────────────────────────────────────────────────────────

def get_historia(consulta_id: str) -> dict | None:
    with _lock:
        entry = _historias.get(consulta_id)

    if entry is not None:
        return dict(entry)

    # Fallback: Supabase
    try:
        from app.services import supabase_service
        data = supabase_service.get_historia(consulta_id)
        if data:
            with _lock:
                _historias[consulta_id] = data
            return dict(data)
    except Exception:
        pass

    return None


# ── Actualización ──────────────────────────────────────────────────────────────

def update_historia(consulta_id: str, campos: dict) -> dict:
    """
    Actualiza campos editables. Marca editada_por_medico=True.
    'estado' puede cambiarse a 'revisada' desde aquí.
    """
    campos_validos = {
        k: v for k, v in campos.items()
        if k in CAMPOS_EDITABLES or k == "estado"
    }
    if not campos_validos:
        raise ValueError("No hay campos válidos para actualizar")

    with _lock:
        if consulta_id not in _historias:
            raise KeyError(f"Historia no encontrada para consulta {consulta_id}")
        entry = _historias[consulta_id]
        entry.update(campos_validos)
        entry["editada_por_medico"] = True
        if "estado" not in campos_validos:
            # auto-marcar revisada si el médico editó algo
            if entry.get("estado") == "borrador":
                entry["estado"] = "revisada"
        historia = dict(entry)

    # Persistir (best-effort)
    try:
        from app.services import supabase_service
        historia_id = historia.get("id")
        if historia_id:
            supabase_service.update_historia(historia_id, {
                **campos_validos,
                "editada_por_medico": True,
            })
    except Exception as exc:
        print(f"[Historia] Supabase update fallback: {exc}")

    return historia


# ── Validación ─────────────────────────────────────────────────────────────────

def validar_historia(consulta_id: str) -> dict:
    """Marca la historia como validada con timestamp."""
    from datetime import datetime, timezone

    with _lock:
        if consulta_id not in _historias:
            raise KeyError(f"Historia no encontrada para consulta {consulta_id}")
        entry = _historias[consulta_id]
        entry["estado"] = "validada"
        entry["validated_at"] = datetime.now(timezone.utc).isoformat()
        historia = dict(entry)

    print(f"[Historia] ✓ Validada — consulta={consulta_id} at={historia['validated_at']}")

    try:
        from app.services import supabase_service
        historia_id = historia.get("id")
        if historia_id:
            supabase_service.update_historia(historia_id, {
                "estado": "validada",
                "editada_por_medico": historia.get("editada_por_medico", False),
            })
    except Exception as exc:
        print(f"[Historia] Supabase validar fallback: {exc}")

    return historia
