import os
from groq import Groq
from app.config import config

_client = None


def _get_client() -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=config.GROQ_API_KEY)
    return _client


def transcribir_audio(audio_path: str, tipo: str = "consulta") -> list[dict]:
    """
    Transcribe audio via Groq Whisper API y devuelve segmentos con timestamps.

    Args:
        audio_path: Ruta absoluta al archivo de audio.
        tipo: "consulta" → hablante "sin_clasificar"
              "examen"   → hablante "medico_examen"

    Returns:
        Lista de dicts: {texto, inicio_segundos, fin_segundos, hablante, orden}
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Archivo no encontrado: {audio_path}")

    hablante = "medico_examen" if tipo == "examen" else "sin_clasificar"
    client = _get_client()

    with open(audio_path, "rb") as f:
        response = client.audio.transcriptions.create(
            file=(os.path.basename(audio_path), f),
            model="whisper-large-v3-turbo",
            response_format="verbose_json",
            timestamp_granularities=["segment"],
            language="es",
        )

    resultado: list[dict] = []
    segments = getattr(response, "segments", None) or []

    for i, seg in enumerate(segments):
        texto = (seg.get("text") if isinstance(seg, dict) else getattr(seg, "text", "")).strip()
        if not texto:
            continue
        inicio = seg.get("start") if isinstance(seg, dict) else getattr(seg, "start", 0)
        fin = seg.get("end") if isinstance(seg, dict) else getattr(seg, "end", 0)
        resultado.append({
            "texto": texto,
            "inicio_segundos": round(float(inicio), 3),
            "fin_segundos": round(float(fin), 3),
            "hablante": hablante,
            "orden": i,
        })
        print(f"[Groq Whisper] seg {i:02d} [{inicio:.1f}s→{fin:.1f}s] {texto}")

    # Fallback: si Groq no devuelve segmentos, crear uno con el texto completo
    if not resultado:
        texto_completo = getattr(response, "text", "").strip()
        if texto_completo:
            resultado.append({
                "texto": texto_completo,
                "inicio_segundos": 0.0,
                "fin_segundos": 0.0,
                "hablante": hablante,
                "orden": 0,
            })

    print(f"[Groq Whisper] {len(resultado)} segmentos transcritos.")
    return resultado
