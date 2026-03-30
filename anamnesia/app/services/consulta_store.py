"""
Store en memoria para metadatos de consultas.

Fuente de verdad para el dashboard: combina datos de este store
con los estados de transcripcion_service e historia_service.

Supabase como persistencia opcional (best-effort).
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone, date

# ── Store ──────────────────────────────────────────────────────────────────────
# { consulta_id: { id, paciente_nombre, fecha, audio_url, duracion_segundos } }
_consultas: dict[str, dict] = {}
_lock = threading.Lock()


# ── Escritura ──────────────────────────────────────────────────────────────────

def registrar(
    consulta_id: str,
    paciente_nombre: str,
    audio_url: str,
    duracion_segundos: int | None = None,
    paciente_id: str | None = None,
    medico_id: str | None = None,
) -> None:
    """Guarda o actualiza los metadatos básicos de una consulta."""
    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        existing = _consultas.get(consulta_id, {})
        _consultas[consulta_id] = {
            "id": consulta_id,
            "paciente_nombre": paciente_nombre or "Paciente",
            "fecha": existing.get("fecha", now),
            "audio_url": audio_url,
            "duracion_segundos": duracion_segundos or existing.get("duracion_segundos"),
            "paciente_id": paciente_id or existing.get("paciente_id"),
            "medico_id": medico_id or existing.get("medico_id"),
        }


def actualizar_duracion(consulta_id: str, duracion_segundos: float) -> None:
    with _lock:
        if consulta_id in _consultas:
            _consultas[consulta_id]["duracion_segundos"] = int(duracion_segundos)


def get(consulta_id: str) -> dict | None:
    """Retorna los metadatos crudos de una consulta desde el store en memoria."""
    with _lock:
        entry = _consultas.get(consulta_id)
        return dict(entry) if entry else None


def get_consultas_by_paciente(paciente_id: str) -> list[dict]:
    """Retorna las consultas de un paciente filtradas por paciente_id."""
    with _lock:
        snapshot = dict(_consultas)
    results = []
    for cid, meta in snapshot.items():
        if meta.get("paciente_id") == paciente_id:
            results.append(_item(cid, meta))
    results.sort(key=lambda i: i["fecha"], reverse=True)
    return results


# ── Lectura ────────────────────────────────────────────────────────────────────

def _derivar_estado(consulta_id: str) -> str:
    """
    Derivan el estado de negocio combinando transcripcion + historia stores.

    transcribiendo → transcribiendo
    transcripcion listo + sin historia → "listo"
    historia generando               → "generando"
    historia borrador                → "pendiente"
    historia revisada                → "revisada"
    historia validada                → "validada"
    cualquier error                  → "error"
    """
    from app.services import transcripcion_service, historia_service

    tx = transcripcion_service.get_transcripcion(consulta_id)
    if tx is None:
        return "transcribiendo"

    tx_estado = tx.get("estado", "transcribiendo")
    if tx_estado == "error":
        return "error"
    if tx_estado == "transcribiendo":
        return "transcribiendo"

    # tx_estado == "listo"
    h = historia_service.get_historia(consulta_id)
    if h is None:
        return "listo"

    h_estado = h.get("estado")
    if h_estado == "error":
        return "listo"    # puede reintentar
    if h_estado == "generando":
        return "generando"
    if h_estado == "borrador":
        return "pendiente"
    if h_estado in ("revisada", "validada"):
        return h_estado

    return "listo"


def _item(consulta_id: str, meta: dict) -> dict:
    """Construye el dict de consulta para la API."""
    from app.services import historia_service

    estado = _derivar_estado(consulta_id)
    h = historia_service.get_historia(consulta_id)
    validated_at = h.get("validated_at") if h else None

    return {
        "id": consulta_id,
        "paciente_nombre": meta["paciente_nombre"],
        "fecha": meta["fecha"],
        "estado": estado,
        "duracion_segundos": meta.get("duracion_segundos"),
        "audio_url": meta.get("audio_url"),
        "tiene_historia": h is not None and h.get("estado") not in (None, "error", "generando"),
        "validated_at": validated_at,
        "paciente_id": meta.get("paciente_id"),
    }


def list_consultas(
    estado: str | None = None,
    fecha: str | None = None,    # YYYY-MM-DD
    page: int = 1,
    per_page: int = 20,
    medico_id: str | None = None,
) -> dict:
    """
    Lista paginada de consultas con filtros opcionales.

    Args:
        estado:    filtro exacto por estado derivado
        fecha:     filtro por día (YYYY-MM-DD) sobre el campo 'fecha'
        page:      número de página (1-based)
        per_page:  tamaño de página
        medico_id: filtrar solo consultas de este médico

    Returns:
        { items, total, page, per_page, pages }
    """
    with _lock:
        snapshot = dict(_consultas)

    # Filtrar por médico primero (en meta, antes de construir items)
    if medico_id:
        snapshot = {cid: meta for cid, meta in snapshot.items()
                    if meta.get("medico_id") == medico_id}

    items = [_item(cid, meta) for cid, meta in snapshot.items()]

    # ── Filtros ────────────────────────────────────────────────────────────────
    if estado:
        items = [i for i in items if i["estado"] == estado]

    if fecha:
        try:
            target = date.fromisoformat(fecha)
            items = [
                i for i in items
                if date.fromisoformat(i["fecha"][:10]) == target
            ]
        except ValueError:
            pass  # fecha mal formateada — ignorar filtro

    # Más reciente primero
    items.sort(key=lambda i: i["fecha"], reverse=True)

    # ── Paginación ─────────────────────────────────────────────────────────────
    total = len(items)
    pages = max(1, (total + per_page - 1) // per_page)
    page = max(1, min(page, pages))
    offset = (page - 1) * per_page
    items = items[offset: offset + per_page]

    return {"items": items, "total": total, "page": page, "per_page": per_page, "pages": pages}


def stats() -> dict:
    """
    Estadísticas para el dashboard.

    Returns:
        { total, pendientes_validar, validadas_hoy }
    """
    with _lock:
        ids = list(_consultas.keys())

    hoy = date.today().isoformat()
    total = 0
    pendientes = 0
    validadas_hoy = 0

    PENDIENTES_ESTADOS = {"transcribiendo", "listo", "generando", "pendiente", "revisada"}

    for cid in ids:
        with _lock:
            meta = _consultas.get(cid)
        if not meta:
            continue
        total += 1
        estado = _derivar_estado(cid)
        if estado in PENDIENTES_ESTADOS:
            pendientes += 1
        if estado == "validada":
            from app.services import historia_service
            h = historia_service.get_historia(cid)
            vat = h.get("validated_at") if h else None
            if vat and vat[:10] == hoy:
                validadas_hoy += 1

    return {"total": total, "pendientes_validar": pendientes, "validadas_hoy": validadas_hoy}
