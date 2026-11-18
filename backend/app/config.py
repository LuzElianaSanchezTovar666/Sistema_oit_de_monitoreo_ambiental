import os
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

# Cargar .env desde la raíz del proyecto o backend/.env sin sobrescribir variables del entorno
_ROOT_DIR = Path(__file__).resolve().parents[2]
_BACKEND_DIR = Path(__file__).resolve().parents[1]
load_dotenv(_ROOT_DIR / ".env", override=False)
load_dotenv(_BACKEND_DIR / ".env", override=False)


class Settings:
    def __init__(self) -> None:
        self.db_host: str = os.getenv("DB_HOST", "127.0.0.1")
        self.db_port: int = int(os.getenv("DB_PORT", "3306"))
        self.db_user: str = os.getenv("DB_USER", "root")
        self.db_password: str = os.getenv("DB_PASSWORD", "")
        self.db_name: str = os.getenv("DB_NAME", "simoa")

        self.jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "")
        if not self.jwt_secret_key:
            raise RuntimeError(
                "La variable de entorno JWT_SECRET_KEY es obligatoria para iniciar el backend de SIMOA."
            )

        self.jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
        self.jwt_expire_hours: int = int(os.getenv("JWT_EXPIRE_HOURS", "8"))

        self.cookie_secure: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
        self.cookie_samesite: str = os.getenv("COOKIE_SAMESITE", "lax")
        self.frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3005")
        self.rate_limit_max_attempts: int = int(os.getenv("LOGIN_MAX_ATTEMPTS", "5"))
        self.rate_limit_window_seconds: int = int(os.getenv("LOGIN_WINDOW_SECONDS", "60"))

        self.mqtt_broker_host: str = os.getenv("MQTT_BROKER_HOST", "127.0.0.1")
        self.mqtt_broker_port: int = int(os.getenv("MQTT_BROKER_PORT", "1883"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
