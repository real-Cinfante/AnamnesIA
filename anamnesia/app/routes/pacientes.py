from flask import Blueprint, jsonify, request
from app.utils.rut import validar_rut

bp = Blueprint("pacientes", __name__)


@bp.get("/")
def listar_pacientes():
    """
    Lista todos los pacientes.
    Query param opcional: q=<texto> para búsqueda parcial por nombre o RUT.

    Respuesta 200:
        { "ok": true, "data": [ ...pacientes ] }
    """
    from app.services import paciente_service

    q = request.args.get("q", "").strip()
    if q:
        resultados = paciente_service.buscar(q)
    else:
        resultados = paciente_service.listar_todos()

    return jsonify({"ok": True, "data": resultados})


@bp.get("/buscar")
def buscar_paciente():
    """
    Busca un paciente por RUT exacto.
    Query param: rut=12345678-5

    Respuesta 200:
        { "ok": true, "data": { ...paciente } }
    Respuesta 404:
        { "error": "Paciente no encontrado" }
    """
    from app.services import paciente_service

    rut = request.args.get("rut", "").strip()
    if not rut:
        return jsonify({"error": "Parámetro 'rut' requerido"}), 400

    paciente = paciente_service.buscar_por_rut(rut)
    if paciente is None:
        return jsonify({"error": "Paciente no encontrado"}), 404

    return jsonify({"ok": True, "data": paciente})


@bp.post("/")
def crear_paciente():
    """
    Crea un nuevo paciente.

    Body JSON:
        { "rut": "...", "nombre": "...", "fecha_nacimiento"?: "...",
          "sexo"?: "...", "telefono"?: "...", "email"?: "..." }

    Respuesta 201:
        { "ok": true, "data": { ...paciente } }
    Respuesta 400:
        { "error": "RUT inválido" | "Ya existe..." | "Campos requeridos..." }
    """
    from app.services import paciente_service

    body = request.get_json(silent=True) or {}
    rut = body.get("rut", "").strip()
    nombre = body.get("nombre", "").strip()

    if not rut or not nombre:
        return jsonify({"error": "Los campos 'rut' y 'nombre' son requeridos"}), 400

    if not validar_rut(rut):
        return jsonify({"error": f"RUT inválido: {rut}"}), 400

    try:
        paciente = paciente_service.crear_paciente(
            rut=rut,
            nombre=nombre,
            fecha_nacimiento=body.get("fecha_nacimiento"),
            sexo=body.get("sexo"),
            telefono=body.get("telefono"),
            email=body.get("email"),
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"ok": True, "data": paciente}), 201


@bp.get("/<paciente_id>")
def get_paciente(paciente_id: str):
    """
    Retorna un paciente por ID.

    Respuesta 200:
        { "ok": true, "data": { ...paciente } }
    Respuesta 404:
        { "error": "Paciente no encontrado" }
    """
    from app.services import paciente_service

    paciente = paciente_service.get_paciente(paciente_id)
    if paciente is None:
        return jsonify({"error": "Paciente no encontrado"}), 404

    return jsonify({"ok": True, "data": paciente})


@bp.get("/<paciente_id>/consultas")
def get_consultas_paciente(paciente_id: str):
    """
    Retorna las consultas de un paciente ordenadas por fecha descendente.

    Respuesta 200:
        { "ok": true, "data": [ ...consultas ] }
    """
    from app.services import paciente_service

    consultas = paciente_service.get_consultas_paciente(paciente_id)
    return jsonify({"ok": True, "data": consultas})
