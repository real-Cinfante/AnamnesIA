"""
Servicio de transcripción: diarización heurística + almacenamiento.

Diarización v1 (heurística):
  - El médico habla primero.
  - Pausa > PAUSA_CAMBIO segundos entre segmentos → cambio de hablante.
  - Pausa corta → mismo hablante (habla continua o aclaraciones).
  - Los segmentos de tipo "examen" quedan como "medico_examen" (ya etiquetados por Whisper).

v2 (futuro): reemplazar con pyannote-audio para diarización real.
"""

from __future__ import annotations
import threading

# ── Store en memoria (fallback cuando Supabase no está configurado) ─────────────
# { consulta_id: { estado, audio_url, segmentos, error } }
_store: dict[str, dict] = {}
_store_lock = threading.Lock()

PAUSA_CAMBIO_SEG = 1.5   # segundos de silencio que sugieren cambio de turno


# ── Diarización ────────────────────────────────────────────────────────────────

def aplicar_diarizacion(segmentos: list[dict]) -> list[dict]:
    """
    Etiqueta segmentos 'sin_clasificar' como 'medico' / 'paciente' alternantes.
    Los segmentos 'medico_examen' se dejan intactos.

    Heurística:
      - Primer hablante: médico.
      - Cambio cuando la pausa desde el fin del segmento anterior supera PAUSA_CAMBIO_SEG.
      - Pausa corta → mismo hablante (continuación de idea).
    """
    if not segmentos:
        return segmentos

    hablantes = ["medico", "paciente"]
    idx = 0          # comienza con médico
    prev_fin = 0.0
    resultado: list[dict] = []

    for seg in segmentos:
        s = dict(seg)

        if s["hablante"] == "sin_clasificar":
            pausa = s["inicio_segundos"] - prev_fin
            if resultado and pausa > PAUSA_CAMBIO_SEG:
                idx = 1 - idx
            s["hablante"] = hablantes[idx]

        resultado.append(s)
        prev_fin = s["fin_segundos"]

    return resultado


# ── Store helpers ──────────────────────────────────────────────────────────────

def registrar_inicio(consulta_id: str, audio_url: str) -> None:
    """Marca la consulta como 'transcribiendo' en el store."""
    with _store_lock:
        _store[consulta_id] = {
            "estado": "transcribiendo",
            "audio_url": audio_url,
            "segmentos": [],
            "error": None,
        }


def registrar_resultado(consulta_id: str, segmentos: list[dict]) -> None:
    """Guarda segmentos en memoria y, si Supabase está disponible, también allí."""
    with _store_lock:
        entry = _store.setdefault(consulta_id, {})
        entry["estado"] = "listo"
        entry["segmentos"] = segmentos
        entry["error"] = None

    # Intentar persistir en Supabase (opcional — falla silenciosa si no está configurado)
    try:
        from app.services import supabase_service
        rows = [
            {
                "consulta_id": consulta_id,
                "hablante": s["hablante"],
                "texto": s["texto"],
                "inicio_segundos": s["inicio_segundos"],
                "fin_segundos": s["fin_segundos"],
                "orden": s["orden"],
            }
            for s in segmentos
        ]
        if rows:
            supabase_service.create_segmentos(rows)
    except Exception as exc:
        print(f"[Transcripcion] Supabase no disponible, segmentos solo en memoria: {exc}")


def registrar_error(consulta_id: str, error: str) -> None:
    with _store_lock:
        entry = _store.setdefault(consulta_id, {})
        entry["estado"] = "error"
        entry["error"] = error


def get_transcripcion(consulta_id: str) -> dict | None:
    """
    Lee la transcripción del store en memoria.
    Si no está en memoria, intenta Supabase como fallback.
    Retorna None si no existe nada para ese consulta_id.
    """
    with _store_lock:
        entry = _store.get(consulta_id)

    if entry is not None:
        return {
            "consulta_id": consulta_id,
            "estado": entry.get("estado", "desconocido"),
            "audio_url": entry.get("audio_url"),
            "segmentos": entry.get("segmentos", []),
            "error": entry.get("error"),
        }

    # Fallback: Supabase
    try:
        from app.services import supabase_service
        segmentos = supabase_service.get_segmentos(consulta_id)
        if segmentos:
            return {
                "consulta_id": consulta_id,
                "estado": "listo",
                "audio_url": None,
                "segmentos": segmentos,
                "error": None,
            }
    except Exception:
        pass

    return None
