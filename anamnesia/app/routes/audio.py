import os
import uuid
import threading
from flask import Blueprint, jsonify, request, current_app, g
from app.config import config

bp = Blueprint("audio", __name__)

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "../../../uploads")

_MIME_TO_EXT: dict[str, str] = {
    "audio/webm": ".webm",
    "audio/webm;codecs=opus": ".webm",
    "audio/ogg": ".ogg",
    "audio/ogg;codecs=opus": ".ogg",
    "audio/mp4": ".mp4",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
}


def _ext_from_mime(mime: str) -> str:
    return _MIME_TO_EXT.get(mime.split(";")[0].strip().lower(), ".webm")


def _pipeline(app, audio_path: str, consulta_id: str, tipo: str, audio_url: str) -> None:
    """
    Pipeline completo en background thread:
      1. Transcribir con Whisper
      2. Aplicar diarización heurística
      3. Guardar segmentos (memoria + Supabase si disponible)
      4. Actualizar duración en consulta_store
    """
    with app.app_context():
        from app.services import whisper_service, transcripcion_service, consulta_store

        print(f"\n[Pipeline] ▶ consulta={consulta_id}  tipo={tipo}")
        print(f"[Pipeline]   archivo: {audio_path}\n")

        try:
            # 1. Transcripción
            segmentos = whisper_service.transcribir_audio(audio_path, tipo=tipo)
            print(f"\n[Pipeline] ✓ Whisper → {len(segmentos)} segmentos crudos")

            # 2. Diarización
            segmentos = transcripcion_service.aplicar_diarizacion(segmentos)
            for s in segmentos:
                print(f"  [{s['hablante'].upper():15s} | {s['inicio_segundos']:.1f}s→{s['fin_segundos']:.1f}s] {s['texto']}")

            # 3. Guardar
            transcripcion_service.registrar_resultado(consulta_id, segmentos)
            print(f"\n[Pipeline] ✓ Guardados {len(segmentos)} segmentos  consulta={consulta_id}\n")

            # 4. Actualizar duración derivada del último segmento
            if segmentos:
                duracion = max(s["fin_segundos"] for s in segmentos)
                consulta_store.actualizar_duracion(consulta_id, duracion)

        except Exception as exc:
            from app.services import transcripcion_service as ts
            ts.registrar_error(consulta_id, str(exc))
            print(f"[Pipeline] ✗ Error: {exc}\n")


@bp.post("/upload")
def upload_audio():
    """
    Recibe el archivo de audio, lo guarda y lanza el pipeline en background.

    Form fields:
        audio       — archivo de audio (multipart)
        consulta_id — UUID generado en el frontend (se crea uno si falta)
        tipo        — "consulta" | "examen"  (default: "consulta")
    """
    if "audio" not in request.files:
        return jsonify({"error": "No se recibió el campo 'audio'"}), 400

    file = request.files["audio"]

    consulta_id = request.form.get("consulta_id") or str(uuid.uuid4())
    tipo = request.form.get("tipo", "consulta")
    if tipo not in ("consulta", "examen"):
        tipo = "consulta"

    mime = file.content_type or "audio/webm"
    ext = _ext_from_mime(mime)
    filename = f"{consulta_id}{ext}"

    os.makedirs(UPLOADS_DIR, exist_ok=True)
    audio_path = os.path.join(UPLOADS_DIR, filename)
    file.save(audio_path)

    size_kb = os.path.getsize(audio_path) / 1024
    audio_url = f"/api/audio/file/{filename}"
    print(f"[Audio] Guardado: {filename} ({size_kb:.1f} KB)")

    # Registrar metadatos de la consulta
    paciente_nombre = request.form.get("paciente_nombre", "Paciente")
    paciente_id = request.form.get("paciente_id", "").strip() or None
    rut = request.form.get("rut", "").strip() or None

    # Resolver paciente_id y nombre a partir de los datos disponibles
    if paciente_id:
        try:
            from app.services import paciente_service
            paciente = paciente_service.get_paciente(paciente_id)
            if paciente:
                paciente_nombre = paciente["nombre"]
        except Exception as exc:
            print(f"[Audio] Error resolviendo paciente_id: {exc}")
    elif rut:
        try:
            from app.services import paciente_service
            paciente = paciente_service.buscar_por_rut(rut)
            if paciente:
                paciente_id = paciente["id"]
                paciente_nombre = paciente["nombre"]
        except Exception as exc:
            print(f"[Audio] Error resolviendo rut: {exc}")

    medico_id = getattr(g, "medico_id", None)

    from app.services import transcripcion_service, consulta_store
    transcripcion_service.registrar_inicio(consulta_id, audio_url)
    consulta_store.registrar(consulta_id, paciente_nombre, audio_url, paciente_id=paciente_id, medico_id=medico_id)

    # Lanzar pipeline asíncrono
    app = current_app._get_current_object()
    threading.Thread(
        target=_pipeline,
        args=(app, audio_path, consulta_id, tipo, audio_url),
        daemon=True,
    ).start()

    return jsonify({
        "ok": True,
        "data": {
            "consulta_id": consulta_id,
            "filename": filename,
            "audio_url": audio_url,
            "size_kb": round(size_kb, 1),
        },
    }), 202


@bp.get("/file/<filename>")
def serve_audio(filename: str):
    """Sirve el archivo de audio guardado."""
    from flask import send_from_directory
    return send_from_directory(os.path.abspath(UPLOADS_DIR), filename)
