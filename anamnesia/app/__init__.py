import os
import jwt as pyjwt
from jwt import PyJWKSet
import requests as http_requests
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

# ── JWKS cache (singleton) ───────────────────────────────────────────────────
_jwk_set: PyJWKSet | None = None


def _get_jwk_set() -> PyJWKSet | None:
    """Fetch JWKS from Supabase once and cache it."""
    global _jwk_set
    if _jwk_set is None:
        supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        if supabase_url:
            jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
            resp = http_requests.get(jwks_url, timeout=10)
            resp.raise_for_status()
            _jwk_set = PyJWKSet.from_dict(resp.json())
    return _jwk_set


def _get_signing_key_from_jwt(token: str):
    """Extract kid from token header and find matching key in JWKS."""
    jwk_set = _get_jwk_set()
    if jwk_set is None:
        return None
    header = pyjwt.get_unverified_header(token)
    kid = header.get("kid")
    for key in jwk_set.keys:
        if key.key_id == kid:
            return key.key
    # If no kid match, use first key
    return jwk_set.keys[0].key if jwk_set.keys else None


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret")

    # CORS: allow frontend origins
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # ── Middleware: JWT auth ───────────────────────────────────────────────────
    PUBLIC_PATHS = {"/api/health"}

    @app.before_request
    def check_auth():
        # Skip preflight and public routes
        if request.method == "OPTIONS":
            return
        if request.path in PUBLIC_PATHS:
            return

        supabase_url = os.getenv("SUPABASE_URL", "")

        # No Supabase URL → modo dev
        if not supabase_url:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header.removeprefix("Bearer ").strip()
                try:
                    payload = pyjwt.decode(
                        token,
                        options={"verify_signature": False},
                        algorithms=["ES256", "HS256"],
                    )
                    g.medico_id = payload.get("sub", "dev-medico")
                except Exception:
                    g.medico_id = "dev-medico"
                return

            required_key = os.getenv("BACKEND_API_KEY", "")
            if required_key:
                key = request.headers.get("X-API-Key")
                if key != required_key:
                    return jsonify({"error": "Unauthorized"}), 401
            g.medico_id = "dev-medico"
            return

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Token de autenticación requerido"}), 401

        token = auth_header.removeprefix("Bearer ").strip()

        try:
            signing_key = _get_signing_key_from_jwt(token)
            if signing_key is None:
                return jsonify({"error": "No se pudo obtener clave de verificación"}), 500

            payload = pyjwt.decode(
                token,
                signing_key,
                algorithms=["ES256", "HS256"],
                options={"verify_aud": False},
            )
            g.medico_id = payload.get("sub", "")
            if not g.medico_id:
                return jsonify({"error": "Token inválido: sin sub"}), 401
        except pyjwt.ExpiredSignatureError:
            return jsonify({"error": "Token expirado"}), 401
        except pyjwt.InvalidTokenError as exc:
            return jsonify({"error": f"Token inválido: {exc}"}), 401

    # ── Blueprints ─────────────────────────────────────────────────────────────
    from app.routes.consultas import bp as consultas_bp
    from app.routes.audio import bp as audio_bp
    from app.routes.historias import bp as historias_bp
    from app.routes.pacientes import bp as pacientes_bp

    app.register_blueprint(consultas_bp, url_prefix="/api/consultas")
    app.register_blueprint(audio_bp, url_prefix="/api/audio")
    app.register_blueprint(historias_bp, url_prefix="/api/historias")
    app.register_blueprint(pacientes_bp, url_prefix="/api/pacientes")

    # ── Health check (público) ─────────────────────────────────────────────────
    @app.get("/api/health")
    def health():
        return jsonify({"ok": True, "service": "anamnesia-backend"})

    return app
