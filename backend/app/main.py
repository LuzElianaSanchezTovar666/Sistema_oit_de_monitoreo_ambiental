from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import run_migrations
from .routers import alertas, auth, configuraciones, dispositivos, mediciones, mqtt, protected_simoa, sensores, ubicaciones
from .services.alerts_service import alerts_service
from .services.mqtt_ingest import mqtt_service


@asynccontextmanager
async def lifespan(_app: FastAPI):
    run_migrations()
    alerts_service.start()
    mqtt_service.start(wait_connect_seconds=0.0)
    try:
        yield
    finally:
        mqtt_service.stop()
        alerts_service.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SIMOA API · Autenticación y Control de Acceso (RF-01)",
        version="1.0.0",
        description="Backend FastAPI con MySQL, bcrypt, JWT HS256 (8h) y RBAC para SIMOA.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin, "http://localhost:3000", "http://localhost:3005"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
    )

    app.include_router(auth.router)
    app.include_router(ubicaciones.router)
    app.include_router(dispositivos.router)
    app.include_router(sensores.router)
    app.include_router(configuraciones.router)
    app.include_router(mediciones.router)
    app.include_router(alertas.router)
    app.include_router(mqtt.router)
    app.include_router(protected_simoa.router)

    @app.get("/api/health")
    def health_check():
        return {"status": "ok", "service": "simoa-auth-backend"}

    return app


app = create_app()
