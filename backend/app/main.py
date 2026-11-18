from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import run_migrations
from .routers import auth, dispositivos, protected_simoa, sensores, ubicaciones


@asynccontextmanager
async def lifespan(_app: FastAPI):
    run_migrations()
    yield


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
    app.include_router(protected_simoa.router)

    @app.get("/api/health")
    def health_check():
        return {"status": "ok", "service": "simoa-auth-backend"}

    return app


app = create_app()
