import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Flask
    SECRET_KEY: str = os.getenv("FLASK_SECRET_KEY", "dev-secret")
    ENV: str = os.getenv("FLASK_ENV", "development")

    # AI (Groq o Anthropic)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

    # Auth
    BACKEND_API_KEY: str = os.getenv("BACKEND_API_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")

    # Whisper
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "medium")

    # Audio storage
    AUDIO_STORAGE_PATH: str = os.getenv(
        "AUDIO_STORAGE_PATH", "/tmp/anamnesia/audio"
    )


config = Config()
