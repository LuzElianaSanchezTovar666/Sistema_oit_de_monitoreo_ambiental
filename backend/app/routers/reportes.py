from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..dependencies import require_roles
from ..services.reports_service import (
    get_environmental_report_data,
    generate_environmental_pdf,
    generate_environmental_excel,
)

router = APIRouter(prefix="/api/reportes", tags=["Reportes Ambientales (RF-16)"])


class EnvironmentalReportRequest(BaseModel):
    formato: str = Field(default="pdf", pattern="^(pdf|excel|xlsx)$")
    fecha_inicio: Optional[str] = Field(default=None, max_length=40)
    fecha_fin: Optional[str] = Field(default=None, max_length=40)
    tz_offset_minutes: int = Field(default=0, ge=-840, le=840)
    ubicacion_id: Optional[str] = Field(default=None, max_length=64)
    dispositivo_id: Optional[str] = Field(default=None, max_length=64)
    sensor_id: Optional[str] = Field(default=None, max_length=64)


def _build_report_response(
    formato: str,
    fecha_inicio: Optional[str],
    fecha_fin: Optional[str],
    tz_offset_minutes: int,
    ubicacion_id: Optional[str],
    dispositivo_id: Optional[str],
    sensor_id: Optional[str],
    current_user: Dict[str, Any],
) -> Response:
    fmt = formato.lower().strip()
    if fmt not in ("pdf", "excel", "xlsx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no soportado. Seleccione 'pdf' o 'excel'.",
        )

    # 1. Obtener datos completos de mediciones y alertas
    data = get_environmental_report_data(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        tz_offset_minutes=tz_offset_minutes,
        ubicacion_id=ubicacion_id,
        dispositivo_id=dispositivo_id,
        sensor_id=sensor_id,
        current_user=current_user,
    )

    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    
    # 2. Generar archivo binario según formato solicitado
    if fmt == "pdf":
        file_bytes = generate_environmental_pdf(data)
        media_type = "application/pdf"
        filename = f"simoa_reporte_ambiental_{timestamp_str}.pdf"
    else:
        file_bytes = generate_environmental_excel(data)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"simoa_reporte_ambiental_{timestamp_str}.xlsx"

    conf_pct = data["estadisticas"]["conformidad"]["porcentaje"]
    conf_header = f"{conf_pct:.2f}" if conf_pct is not None else "N/A"

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "Content-Length": str(len(file_bytes)),
        "X-Report-Total-Records": str(data["estadisticas"]["total_registros"]),
        "X-Report-Conformidad": conf_header,
        "Access-Control-Expose-Headers": "Content-Disposition, X-Report-Total-Records, X-Report-Conformidad",
    }

    return Response(content=file_bytes, media_type=media_type, headers=headers)


@router.post("/ambientales")
def generate_environmental_report_post(
    payload: EnvironmentalReportRequest,
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Supervisor")
    ),
) -> Response:
    """RF-16: Generación y descarga de reporte ambiental (PDF o Excel) mediante POST."""
    return _build_report_response(
        formato=payload.formato,
        fecha_inicio=payload.fecha_inicio,
        fecha_fin=payload.fecha_fin,
        tz_offset_minutes=payload.tz_offset_minutes,
        ubicacion_id=payload.ubicacion_id,
        dispositivo_id=payload.dispositivo_id,
        sensor_id=payload.sensor_id,
        current_user=current_user,
    )


@router.get("/ambientales")
def generate_environmental_report_get(
    formato: str = Query(default="pdf", pattern="^(pdf|excel|xlsx)$"),
    fecha_inicio: Optional[str] = Query(default=None, max_length=40),
    fecha_fin: Optional[str] = Query(default=None, max_length=40),
    tz_offset_minutes: int = Query(default=0, ge=-840, le=840),
    ubicacion_id: Optional[str] = Query(default=None, max_length=64),
    dispositivo_id: Optional[str] = Query(default=None, max_length=64),
    sensor_id: Optional[str] = Query(default=None, max_length=64),
    current_user: Dict[str, Any] = Depends(
        require_roles("Administrador", "Supervisor")
    ),
) -> Response:
    """RF-16: Generación y descarga de reporte ambiental (PDF o Excel) mediante GET."""
    return _build_report_response(
        formato=formato,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        tz_offset_minutes=tz_offset_minutes,
        ubicacion_id=ubicacion_id,
        dispositivo_id=dispositivo_id,
        sensor_id=sensor_id,
        current_user=current_user,
    )
