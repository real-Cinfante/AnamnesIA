from flask import Blueprint, jsonify, request

bp = Blueprint("historias", __name__)


@bp.get("/<consulta_id>")
def get_historia(consulta_id: str):
    """
    Retorna la historia clínica de una consulta.

    Respuesta:
        {
          "ok": true,
          "data": {
            "id": "...",
            "consulta_id": "...",
            "estado": "generando" | "borrador" | "revisada" | "validada" | "error",
            "anamnesis": "...", "antecedentes": "...", ...
            "editada_por_medico": false,
            "validated_at": null | "ISO8601"
          }
        }
    """
    from app.services import historia_service

    historia = historia_service.get_historia(consulta_id)
    if historia is None:
        return jsonify({"error": "Historia no encontrada"}), 404

    return jsonify({"ok": True, "data": historia})


@bp.put("/<consulta_id>")
@bp.patch("/<consulta_id>")
def update_historia(consulta_id: str):
    """
    Actualiza campos editables de la historia.
    Acepta PUT y PATCH. Marca editada_por_medico=True automáticamente.
    Auto-avanza estado borrador → revisada.

    Body JSON:
        { "anamnesis": "...", "indicaciones": "...", ... }
        { "estado": "revisada" }
    """
    from app.services import historia_service

    body = request.get_json(silent=True) or {}
    if not body:
        return jsonify({"error": "Body JSON requerido"}), 400

    try:
        historia = historia_service.update_historia(consulta_id, body)
    except KeyError as exc:
        return jsonify({"error": str(exc)}), 404
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"ok": True, "data": historia})


@bp.post("/<consulta_id>/validar")
def validar_historia(consulta_id: str):
    """
    Marca la historia como validada y registra el timestamp.
    Estado: * → "validada"
    """
    from app.services import historia_service

    try:
        historia = historia_service.validar_historia(consulta_id)
    except KeyError as exc:
        return jsonify({"error": str(exc)}), 404

    # Trigger profile update in background if consulta has paciente_id
    try:
        from app.services import consulta_store, paciente_service
        import threading
        consulta = consulta_store.get(consulta_id)
        if consulta and consulta.get("paciente_id"):
            threading.Thread(
                target=paciente_service.actualizar_perfil,
                args=(consulta["paciente_id"], consulta_id),
                daemon=True,
            ).start()
    except Exception as e:
        print(f"[Paciente] Error triggering profile update: {e}")

    return jsonify({"ok": True, "data": historia})
