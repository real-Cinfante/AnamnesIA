import threading
from flask import Blueprint, jsonify, request, current_app, g

bp = Blueprint("consultas", __name__)


@bp.get("/")
def list_consultas():
    """
    Lista paginada de consultas con filtros opcionales.

    Query params:
        estado    — filtro por estado derivado (transcribiendo|listo|generando|pendiente|revisada|validada|error)
        fecha     — filtro por día YYYY-MM-DD
        page      — página (default 1)
        per_page  — tamaño de página (default 20, max 100)
    """
    from app.services import consulta_store

    estado = request.args.get("estado") or None
    fecha = request.args.get("fecha") or None
    page = max(1, int(request.args.get("page", 1)))
    per_page = min(100, max(1, int(request.args.get("per_page", 20))))

    medico_id = getattr(g, "medico_id", None)
    resultado = consulta_store.list_consultas(estado=estado, fecha=fecha, page=page, per_page=per_page, medico_id=medico_id)
    return jsonify({"ok": True, "data": resultado})


@bp.get("/stats")
def get_stats():
    """Estadísticas para el dashboard: total, pendientes, validadas hoy."""
    from app.services import consulta_store
    return jsonify({"ok": True, "data": consulta_store.stats()})


@bp.post("/")
def create_consulta():
    # TODO: validar body, crear consulta en Supabase
    return jsonify({"ok": True, "data": {}}), 201


@bp.get("/<consulta_id>")
def get_consulta(consulta_id: str):
    from app.services import consulta_store, transcripcion_service, historia_service

    meta = consulta_store.get(consulta_id)
    if meta is None:
        return jsonify({"error": "Consulta no encontrada"}), 404

    tx = transcripcion_service.get_transcripcion(consulta_id)
    h  = historia_service.get_historia(consulta_id)

    from app.services.consulta_store import _derivar_estado
    estado = _derivar_estado(consulta_id)

    return jsonify({"ok": True, "data": {
        "id": consulta_id,
        "paciente_nombre": meta.get("paciente_nombre"),
        "paciente_id": meta.get("paciente_id"),
        "fecha": meta.get("fecha"),
        "audio_url": meta.get("audio_url"),
        "duracion_segundos": meta.get("duracion_segundos"),
        "estado": estado,
        "tiene_historia": h is not None and h.get("estado") not in (None, "error", "generando"),
    }})


@bp.patch("/<consulta_id>")
def update_consulta(consulta_id: str):
    # TODO: actualizar estado u otros campos
    return jsonify({"ok": True, "data": {}})


@bp.delete("/<consulta_id>")
def delete_consulta(consulta_id: str):
    # TODO: eliminar consulta y cascada
    return jsonify({"ok": True})


@bp.get("/<consulta_id>/segmentos")
def get_segmentos_legacy(consulta_id: str):
    """Alias de compatibilidad — usar /transcripcion en su lugar."""
    from app.services import transcripcion_service
    data = transcripcion_service.get_transcripcion(consulta_id)
    segmentos = data["segmentos"] if data else []
    return jsonify({"ok": True, "data": segmentos})


@bp.get("/<consulta_id>/transcripcion")
def get_transcripcion(consulta_id: str):
    """
    Retorna el estado actual de la transcripción para esta consulta.

    Respuesta:
        {
          "ok": true,
          "data": {
            "consulta_id": "...",
            "estado": "transcribiendo" | "listo" | "error",
            "audio_url": "/api/audio/file/...",
            "segmentos": [ { hablante, texto, inicio_segundos, fin_segundos, orden } ],
            "error": null | "mensaje"
          }
        }

    Polling recomendado cada 2s mientras estado == "transcribiendo".
    """
    from app.services import transcripcion_service

    data = transcripcion_service.get_transcripcion(consulta_id)

    if data is None:
        return jsonify({"error": f"Consulta '{consulta_id}' no encontrada"}), 404

    return jsonify({"ok": True, "data": data})


@bp.post("/<consulta_id>/generar-historia")
def generar_historia(consulta_id: str):
    """
    Dispara la generación de historia clínica con Claude en background.
    Requiere que la transcripción esté en estado "listo".

    Respuesta inmediata 202:
        { "ok": true, "data": { "consulta_id": "...", "estado": "generando" } }

    Luego hacer polling a GET /api/historias/<consulta_id> cada 2s.
    """
    from app.services import transcripcion_service, historia_service

    # Validar que hay transcripción disponible
    tx = transcripcion_service.get_transcripcion(consulta_id)
    if tx is None:
        return jsonify({"error": "Consulta no encontrada"}), 404
    if tx["estado"] != "listo":
        return jsonify({"error": f"La transcripción no está lista (estado: {tx['estado']})"}), 409
    if not tx["segmentos"]:
        return jsonify({"error": "No hay segmentos de transcripción"}), 409

    # Si ya existe historia (no en error), no regenerar
    existente = historia_service.get_historia(consulta_id)
    if existente and existente.get("estado") not in (None, "error"):
        return jsonify({"ok": True, "data": existente})

    # Marcar como "generando" en el store
    import threading as _threading
    with historia_service._lock:
        historia_service._historias[consulta_id] = {
            "id": None,
            "consulta_id": consulta_id,
            "estado": "generando",
            "error": None,
        }

    app = current_app._get_current_object()
    _threading.Thread(
        target=historia_service.generar_historia_background,
        args=(app, consulta_id),
        daemon=True,
    ).start()

    return jsonify({
        "ok": True,
        "data": {"consulta_id": consulta_id, "estado": "generando"},
    }), 202
