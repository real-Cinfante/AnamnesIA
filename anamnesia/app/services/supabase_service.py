from supabase import create_client, Client
from app.config import config

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        if not config.SUPABASE_URL or not config.SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set")
        _client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)
    return _client


# ── Consultas ──────────────────────────────────────────────────────────────────

def get_consultas(medico_id: str) -> list[dict]:
    db = get_client()
    res = (
        db.table("consultas")
        .select("*")
        .eq("medico_id", medico_id)
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


def get_consulta(consulta_id: str) -> dict | None:
    db = get_client()
    res = db.table("consultas").select("*").eq("id", consulta_id).single().execute()
    return res.data


def create_consulta(payload: dict) -> dict:
    db = get_client()
    res = db.table("consultas").insert(payload).execute()
    return res.data[0]


def update_consulta(consulta_id: str, payload: dict) -> dict:
    db = get_client()
    res = (
        db.table("consultas")
        .update(payload)
        .eq("id", consulta_id)
        .execute()
    )
    return res.data[0]


# ── Segmentos ──────────────────────────────────────────────────────────────────

def get_segmentos(consulta_id: str) -> list[dict]:
    db = get_client()
    res = (
        db.table("segmentos")
        .select("*")
        .eq("consulta_id", consulta_id)
        .order("orden")
        .execute()
    )
    return res.data or []


def create_segmentos(segmentos: list[dict]) -> list[dict]:
    db = get_client()
    res = db.table("segmentos").insert(segmentos).execute()
    return res.data or []


# ── Historias clínicas ─────────────────────────────────────────────────────────

def get_historia(consulta_id: str) -> dict | None:
    db = get_client()
    res = (
        db.table("historias_clinicas")
        .select("*")
        .eq("consulta_id", consulta_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def create_historia(payload: dict) -> dict:
    db = get_client()
    res = db.table("historias_clinicas").insert(payload).execute()
    return res.data[0]


def update_historia(historia_id: str, payload: dict) -> dict:
    db = get_client()
    res = (
        db.table("historias_clinicas")
        .update(payload)
        .eq("id", historia_id)
        .execute()
    )
    return res.data[0]


# ── Pacientes ──────────────────────────────────────────────────────────────────

def get_paciente(paciente_id: str) -> dict | None:
    db = get_client()
    res = (
        db.table("pacientes")
        .select("*")
        .eq("id", paciente_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def get_paciente_by_rut(rut: str) -> dict | None:
    db = get_client()
    res = (
        db.table("pacientes")
        .select("*")
        .eq("rut", rut)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def list_pacientes() -> list[dict]:
    db = get_client()
    res = db.table("pacientes").select("*").order("nombre").execute()
    return res.data or []


def create_paciente(payload: dict) -> dict:
    db = get_client()
    res = db.table("pacientes").insert(payload).execute()
    return res.data[0]


def update_paciente(paciente_id: str, payload: dict) -> dict:
    db = get_client()
    res = (
        db.table("pacientes")
        .update(payload)
        .eq("id", paciente_id)
        .execute()
    )
    return res.data[0]


def get_consultas_by_paciente(paciente_id: str) -> list[dict]:
    db = get_client()
    res = (
        db.table("consultas")
        .select("*")
        .eq("paciente_id", paciente_id)
        .order("fecha", desc=True)
        .execute()
    )
    return res.data or []
