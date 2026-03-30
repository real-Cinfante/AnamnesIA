"""
Servicio de pacientes.

Store en memoria (keyed by paciente_id) como fuente primaria.
Supabase como persistencia opcional (best-effort).
"""
from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone

from app.utils.rut import validar_rut, normalizar_rut
from app.config import config

# ── Store en memoria ───────────────────────────────────────────────────────────
# { paciente_id: { id, rut, nombre, fecha_nacimiento, sexo, telefono, email, perfil_clinico, ... } }
_pacientes: dict[str, dict] = {}
# normalized_rut → paciente_id
_rut_index: dict[str, str] = {}
_lock = threading.Lock()

# ── Groq client singleton ──────────────────────────────────────────────────────
_groq_client = None

SYSTEM_PROMPT_PERFIL = """Eres un asistente de documentación clínica. Actualiza el perfil acumulado de un paciente integrando información nueva de una consulta recién validada. Mantén toda la información previa relevante. Agrega nuevas condiciones, medicamentos, hallazgos. Si un medicamento fue suspendido, muévelo a historial. Solo usa información explícita en la historia clínica. Responde SOLO con JSON válido."""


def _get_groq():
    global _groq_client
    if _groq_client is None:
        from groq import Groq
        if not config.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY debe estar configurado")
        _groq_client = Groq(api_key=config.GROQ_API_KEY)
    return _groq_client


# ── Búsqueda ───────────────────────────────────────────────────────────────────

def listar_todos() -> list[dict]:
    """Retorna todos los pacientes en memoria. Intenta cargar desde Supabase si el store está vacío."""
    with _lock:
        snapshot = list(_pacientes.values())

    if not snapshot:
        try:
            from app.services import supabase_service
            datos = supabase_service.list_pacientes()
            if datos:
                with _lock:
                    for p in datos:
                        _pacientes[p["id"]] = p
                        _rut_index[normalizar_rut(p["rut"])] = p["id"]
                snapshot = datos
        except Exception as exc:
            print(f"[Paciente] Supabase listar_todos fallback: {exc}")

    return [dict(p) for p in snapshot]


def buscar(query: str) -> list[dict]:
    """Búsqueda parcial por nombre o RUT. Devuelve hasta 20 coincidencias."""
    q = query.strip().lower()
    if not q:
        return []

    todos = listar_todos()
    resultados = []
    for p in todos:
        nombre_match = q in p.get("nombre", "").lower()
        rut_match    = q.replace(".", "").replace("-", "") in p.get("rut", "").replace(".", "").replace("-", "")
        if nombre_match or rut_match:
            resultados.append(p)

    resultados.sort(key=lambda p: p.get("nombre", ""))
    return resultados[:20]


def buscar_por_rut(rut: str) -> dict | None:
    """Busca un paciente por RUT. Memory first, Supabase fallback."""
    normalized = normalizar_rut(rut)
    with _lock:
        paciente_id = _rut_index.get(normalized)
        if paciente_id:
            entry = _pacientes.get(paciente_id)
            if entry:
                return dict(entry)

    # Fallback: Supabase
    try:
        from app.services import supabase_service
        data = supabase_service.get_paciente_by_rut(normalized)
        if data:
            with _lock:
                _pacientes[data["id"]] = data
                _rut_index[normalizar_rut(data["rut"])] = data["id"]
            return dict(data)
    except Exception as exc:
        print(f"[Paciente] Supabase buscar_por_rut fallback: {exc}")

    return None


def get_paciente(paciente_id: str) -> dict | None:
    """Obtiene un paciente por ID. Memory first, Supabase fallback."""
    with _lock:
        entry = _pacientes.get(paciente_id)
        if entry:
            return dict(entry)

    # Fallback: Supabase
    try:
        from app.services import supabase_service
        data = supabase_service.get_paciente(paciente_id)
        if data:
            with _lock:
                _pacientes[data["id"]] = data
                _rut_index[normalizar_rut(data["rut"])] = data["id"]
            return dict(data)
    except Exception as exc:
        print(f"[Paciente] Supabase get_paciente fallback: {exc}")

    return None


# ── Creación ───────────────────────────────────────────────────────────────────

def crear_paciente(
    rut: str,
    nombre: str,
    fecha_nacimiento: str | None = None,
    sexo: str | None = None,
    telefono: str | None = None,
    email: str | None = None,
) -> dict:
    """
    Crea un nuevo paciente. Valida RUT con módulo 11.
    Raises ValueError si el RUT es inválido o ya existe.
    """
    if not validar_rut(rut):
        raise ValueError(f"RUT inválido: {rut}")

    normalized = normalizar_rut(rut)

    # Check duplicado en memoria
    with _lock:
        if normalized in _rut_index:
            raise ValueError(f"Ya existe un paciente con RUT {rut}")

    # Check duplicado en Supabase
    try:
        from app.services import supabase_service
        existing = supabase_service.get_paciente_by_rut(normalized)
        if existing:
            with _lock:
                _pacientes[existing["id"]] = existing
                _rut_index[normalized] = existing["id"]
            raise ValueError(f"Ya existe un paciente con RUT {rut}")
    except ValueError:
        raise
    except Exception as exc:
        print(f"[Paciente] Supabase check duplicado fallback: {exc}")

    now = datetime.now(timezone.utc).isoformat()
    paciente_id = str(uuid.uuid4())
    paciente = {
        "id": paciente_id,
        "rut": normalized,
        "nombre": nombre,
        "fecha_nacimiento": fecha_nacimiento,
        "sexo": sexo,
        "telefono": telefono,
        "email": email,
        "perfil_clinico": {},
        "created_at": now,
        "updated_at": now,
    }

    with _lock:
        _pacientes[paciente_id] = paciente
        _rut_index[normalized] = paciente_id

    print(f"[Paciente] ✓ Creado — id={paciente_id} rut={normalized} nombre={nombre}")

    # Persistir en Supabase (best-effort)
    try:
        from app.services import supabase_service
        supabase_service.create_paciente({
            "rut": normalized,
            "nombre": nombre,
            "fecha_nacimiento": fecha_nacimiento,
            "sexo": sexo,
            "telefono": telefono,
            "email": email,
            "perfil_clinico": {},
        })
    except Exception as exc:
        print(f"[Paciente] Supabase no disponible, solo en memoria: {exc}")

    return dict(paciente)


# ── Consultas del paciente ─────────────────────────────────────────────────────

def get_consultas_paciente(paciente_id: str) -> list[dict]:
    """Retorna las consultas de un paciente. Consulta_store + Supabase fallback."""
    results = []

    # Buscar en consulta_store en memoria
    try:
        from app.services import consulta_store
        with consulta_store._lock:
            snapshot = dict(consulta_store._consultas)
        for cid, meta in snapshot.items():
            if meta.get("paciente_id") == paciente_id:
                results.append(consulta_store._item(cid, meta))
    except Exception as exc:
        print(f"[Paciente] consulta_store get_consultas_paciente error: {exc}")

    # Si no hay resultados en memoria, intentar Supabase
    if not results:
        try:
            from app.services import supabase_service
            results = supabase_service.get_consultas_by_paciente(paciente_id)
        except Exception as exc:
            print(f"[Paciente] Supabase get_consultas_paciente fallback: {exc}")

    return results


# ── Actualización de perfil clínico ───────────────────────────────────────────

def actualizar_perfil(paciente_id: str, consulta_id: str) -> None:
    """
    Actualiza el perfil clínico acumulado del paciente con datos de una consulta validada.
    Usa Groq (llama-3.3-70b) para merge inteligente. Best-effort: no crashea.
    """
    try:
        print(f"[Paciente] ▶ Actualizando perfil — paciente={paciente_id} consulta={consulta_id}")

        paciente = get_paciente(paciente_id)
        if not paciente:
            print(f"[Paciente] Paciente {paciente_id} no encontrado, saltando actualización.")
            return

        from app.services import historia_service
        historia = historia_service.get_historia(consulta_id)
        if not historia:
            print(f"[Paciente] Historia de consulta {consulta_id} no encontrada, saltando.")
            return

        perfil_actual = paciente.get("perfil_clinico") or {}
        now = datetime.now(timezone.utc).isoformat()

        consultas_procesadas = perfil_actual.get("consultas_procesadas", 0)

        prompt = f"""Perfil clínico actual del paciente:
{json.dumps(perfil_actual, ensure_ascii=False, indent=2)}

Nueva historia clínica de consulta recién validada:
- Anamnesis: {historia.get('anamnesis', 'Sin información registrada.')}
- Antecedentes: {historia.get('antecedentes', 'Sin información registrada.')}
- Examen físico: {historia.get('examen_fisico', 'Sin información registrada.')}
- Diagnóstico presuntivo: {historia.get('diagnostico_presuntivo', 'Sin información registrada.')}
- Indicaciones: {historia.get('indicaciones', 'Sin información registrada.')}

Devuelve un JSON con exactamente estas claves:
- "condiciones_activas": lista de condiciones médicas activas
- "condiciones_resueltas": lista de condiciones resueltas o pasadas
- "medicamentos_actuales": lista de objetos con {{nombre, dosis, desde}}
- "alergias": lista de alergias conocidas
- "antecedentes_quirurgicos": lista de cirugías o procedimientos previos
- "antecedentes_familiares": lista de antecedentes familiares relevantes
- "habitos": objeto con hábitos relevantes (tabaco, alcohol, ejercicio, etc.)
- "ultima_actualizacion": "{now}"
- "consultas_procesadas": {consultas_procesadas + 1}
"""

        client = _get_groq()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=2000,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_PERFIL},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
        nuevo_perfil = json.loads(response.choices[0].message.content.strip())

        # Actualizar en memoria
        with _lock:
            if paciente_id in _pacientes:
                _pacientes[paciente_id]["perfil_clinico"] = nuevo_perfil
                _pacientes[paciente_id]["updated_at"] = now

        print(f"[Paciente] ✓ Perfil actualizado — paciente={paciente_id}")

        # Persistir en Supabase (best-effort)
        try:
            from app.services import supabase_service
            supabase_service.update_paciente(paciente_id, {
                "perfil_clinico": nuevo_perfil,
                "updated_at": now,
            })
        except Exception as exc:
            print(f"[Paciente] Supabase actualizar_perfil fallback: {exc}")

    except Exception as exc:
        print(f"[Paciente] Error en actualizar_perfil: {exc}")
