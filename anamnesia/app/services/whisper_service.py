import os
from app.config import config

_model = None


def _get_device() -> str:
    """Auto-select compute device: MPS (Apple Silicon) → CUDA → CPU.
    faster-whisper usa CTranslate2, que no soporta MPS nativamente → CPU en Apple Silicon.
    """
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass
    return "cpu"


def _get_compute_type(device: str) -> str:
    if device == "cuda":
        return "float16"
    # int8 es el más rápido y estable en CPU (incluye Apple Silicon)
    return "int8"


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        device = _get_device()
        compute_type = _get_compute_type(device)

        print(f"[Whisper] Cargando modelo '{config.WHISPER_MODEL}' en {device} ({compute_type})…")
        _model = WhisperModel(
            config.WHISPER_MODEL,
            device=device,
            compute_type=compute_type,
        )
        print(f"[Whisper] Modelo listo.")
    return _model


def transcribir_audio(audio_path: str, tipo: str = "consulta") -> list[dict]:
    """
    Transcribe el audio y devuelve segmentos con timestamps.

    Args:
        audio_path: Ruta absoluta al archivo de audio.
        tipo: "consulta" → hablante "sin_clasificar"
              "examen"   → hablante "medico_examen"

    Returns:
        Lista de dicts: {texto, inicio_segundos, fin_segundos, hablante, orden}

    Raises:
        FileNotFoundError: Si audio_path no existe.
        RuntimeError: Si la transcripción falla.
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Archivo no encontrado: {audio_path}")

    model = get_model()
    hablante = "medico_examen" if tipo == "examen" else "sin_clasificar"

    # faster-whisper devuelve un generador — se consume al iterar
    segments_gen, info = model.transcribe(
        audio_path,
        language="es",
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    print(f"[Whisper] Duración detectada: {info.duration:.1f}s  |  idioma: {info.language} ({info.language_probability:.0%})")

    resultado: list[dict] = []
    for i, seg in enumerate(segments_gen):
        texto = seg.text.strip()
        if not texto:
            continue
        segmento = {
            "texto": texto,
            "inicio_segundos": round(seg.start, 3),
            "fin_segundos": round(seg.end, 3),
            "hablante": hablante,
            "orden": i,
        }
        resultado.append(segmento)
        print(f"[Whisper]  seg {i:02d} [{seg.start:.1f}s→{seg.end:.1f}s] {texto}")

    return resultado
