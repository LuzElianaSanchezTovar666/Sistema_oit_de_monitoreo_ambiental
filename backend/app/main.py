from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import run_migrations
from .routers import alertas, auth, cambios, configuraciones, dispositivos, ia, mantenimientos, mediciones, mqtt, protected_simoa, reportes, sensores, ubicaciones
from .services.alerts_service import alerts_service
from .services.device_connectivity import connectivity_monitor
from .services.mqtt_ingest import mqtt_service


@asynccontextmanager
async def lifespan(_app: FastAPI):
    run_migrations()
    try:
        connectivity_monitor.start()
        alerts_service.start()
        mqtt_service.start(wait_connect_seconds=0.0)
        yield
    finally:
        mqtt_service.stop()
        alerts_service.stop()
        connectivity_monitor.stop()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SIMOA API · Monitoreo ambiental",
        version="1.0.0",
        description="API de autenticación, inventario IoT, telemetría, alertas y reportes. "
        "Las operaciones privadas aceptan el JWT de inicio de sesión.",
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
    app.include_router(cambios.router)
    app.include_router(ubicaciones.router)
    app.include_router(dispositivos.router)
    app.include_router(sensores.router)
    app.include_router(mantenimientos.router)
    app.include_router(configuraciones.router)
    app.include_router(mediciones.router)
    app.include_router(ia.router)
    app.include_router(alertas.router)
    app.include_router(reportes.router)
    app.include_router(mqtt.router)
    app.include_router(protected_simoa.router)

    @app.get(
        "/api/health",
        tags=["Diagnóstico del Sistema"],
        summary="Verificación de estado de salud del backend",
        description="Comprueba que el servicio FastAPI esté activo y respondiendo solicitudes.",
    )
    def health_check():
        return {"status": "ok", "service": "simoa-auth-backend"}

    @app.middleware("http")
    async def prevent_api_cache(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    frontend_dir = Path(os.getenv("SIMOA_FRONTEND_DIR") or Path(__file__).resolve().parents[2] / "dist")
    if (frontend_dir / "index.html").is_file():
        app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

    return app


app = create_app()
