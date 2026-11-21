from datetime import datetime, timezone, timedelta
import io
import math
import os
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import pymysql
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    Image,
)
from reportlab.pdfgen import canvas

from ..database import db_cursor
from ..routers.mediciones import _parse_historical_bound


class NumberedCanvas(canvas.Canvas):
    """Canvas de dos pasadas para calcular dinámicamente 'Página X de Y'."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        # Línea separadora de pie de página
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 40, letter[0] - 36, 40)

        footer_text = "SIMOA · Sistema IoT de Monitoreo Ambiental | Reporte Oficial de Calidad Ambiental (RN-18 / RF-16)"
        page_text = f"Página {self._pageNumber} de {page_count}"
        self.drawString(36, 28, footer_text)
        self.drawRightString(letter[0] - 36, 28, page_text)
        self.restoreState()


def get_timezone_label(tz_offset_minutes: int) -> str:
    """Convierte tz_offset_minutes (JS UTC - Local) en etiqueta clara como UTC-05:00."""
    # offset en JS: para UTC-5 es +300 min. Por lo tanto local_tz = -offset
    total_minutes = -tz_offset_minutes
    sign = "+" if total_minutes >= 0 else "-"
    abs_minutes = abs(total_minutes)
    hours = abs_minutes // 60
    minutes = abs_minutes % 60
    label = f"UTC{sign}{hours:02d}:{minutes:02d}"
    if total_minutes == -300:
        return f"{label} (Colombia / COT)"
    return label


def escape_excel_value(val: Any) -> Any:
    """Protección contra inyección de fórmulas en hojas de cálculo."""
    if isinstance(val, str):
        if val.startswith(("=", "+", "-", "@")):
            return f"'{val}"
    return val


def get_environmental_report_data(
    fecha_inicio: Optional[str],
    fecha_fin: Optional[str],
    tz_offset_minutes: int,
    ubicacion_id: Optional[str],
    dispositivo_id: Optional[str],
    sensor_id: Optional[str],
    current_user: Dict[str, Any],
) -> Dict[str, Any]:
    """Consulta consolidada sobre el conjunto COMPLETO de mediciones y alertas coincidentes con los filtros."""
    start_parsed = _parse_historical_bound(fecha_inicio, tz_offset_minutes, is_end=False)
    end_parsed = _parse_historical_bound(fecha_fin, tz_offset_minutes, is_end=True)

    start_utc = start_parsed[0] if start_parsed else None
    end_utc_excl = end_parsed[0] if end_parsed else None

    if start_utc is not None and end_utc_excl is not None and start_utc >= end_utc_excl:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La fecha inicial no puede ser mayor a la final",
        )

    conditions_m: List[str] = []
    params_m: List[Any] = []

    if ubicacion_id and ubicacion_id.strip():
        conditions_m.append("COALESCE(m.ubicacion_id, d.ubicacion_id) = %s")
        params_m.append(ubicacion_id.strip())
    if dispositivo_id and dispositivo_id.strip():
        conditions_m.append("m.dispositivo_id = %s")
        params_m.append(dispositivo_id.strip())
    if sensor_id and sensor_id.strip():
        conditions_m.append("m.sensor_id = %s")
        params_m.append(sensor_id.strip())
    if start_utc is not None:
        conditions_m.append("m.fecha_hora >= %s")
        params_m.append(start_utc)
    if end_utc_excl is not None:
        conditions_m.append("m.fecha_hora < %s")
        params_m.append(end_utc_excl)

    where_m = f"WHERE {' AND '.join(conditions_m)}" if conditions_m else ""

    with db_cursor() as cursor:
        # 1. Obtener nombres human-readable de filtros seleccionados
        ubicacion_nombre = "Todas las ubicaciones"
        if ubicacion_id and ubicacion_id.strip():
            cursor.execute(
                "SELECT nombre, codigo_area FROM ubicaciones WHERE ubicacion_id = %s",
                (ubicacion_id.strip(),),
            )
            u_row = cursor.fetchone()
            if u_row:
                ubicacion_nombre = f"{u_row['nombre']} ({u_row['codigo_area']})"
            else:
                ubicacion_nombre = ubicacion_id.strip()

        dispositivo_nombre = "Todos los dispositivos"
        if dispositivo_id and dispositivo_id.strip():
            cursor.execute(
                "SELECT nombre, codigo FROM dispositivos WHERE id_dispositivo = %s",
                (dispositivo_id.strip(),),
            )
            d_row = cursor.fetchone()
            if d_row:
                dispositivo_nombre = f"{d_row['nombre']} ({d_row['codigo']})"
            else:
                dispositivo_nombre = dispositivo_id.strip()

        sensor_nombre = "Todos los sensores"
        if sensor_id and sensor_id.strip():
            cursor.execute(
                "SELECT identificador, modelo FROM sensores WHERE id_sensor = %s",
                (sensor_id.strip(),),
            )
            s_row = cursor.fetchone()
            if s_row:
                sensor_nombre = f"{s_row['modelo']} - {s_row['identificador']}"
            else:
                sensor_nombre = sensor_id.strip()

        # 2. Agregación estadística exacta idéntica a RF-10
        cursor.execute(
            f"""
            SELECT
              COUNT(*) AS total_records,
              COUNT(m.temperatura) AS temp_count,
              MIN(m.temperatura) AS temp_min,
              MAX(m.temperatura) AS temp_max,
              AVG(m.temperatura) AS temp_avg,
              STDDEV_SAMP(m.temperatura) AS temp_std,
              COUNT(m.humedad) AS hum_count,
              MIN(m.humedad) AS hum_min,
              MAX(m.humedad) AS hum_max,
              AVG(m.humedad) AS hum_avg,
              STDDEV_SAMP(m.humedad) AS hum_std,
              SUM(CASE WHEN m.es_fuera_de_umbral IS NOT NULL THEN 1 ELSE 0 END) AS mediciones_evaluables,
              SUM(CASE WHEN m.es_fuera_de_umbral = 0 THEN 1 ELSE 0 END) AS mediciones_conformes
            FROM mediciones m
            INNER JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
            {where_m}
            """,
            tuple(params_m),
        )
        agg = cursor.fetchone() or {}

        total_records = int(agg.get("total_records") or 0)
        if total_records == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontraron mediciones para el período y los filtros seleccionados",
            )

        # 3. Consulta de incidencias (alertas generadas en el período)
        conditions_a: List[str] = []
        params_a: List[Any] = []
        if ubicacion_id and ubicacion_id.strip():
            conditions_a.append("a.ubicacion_id = %s")
            params_a.append(ubicacion_id.strip())
        if dispositivo_id and dispositivo_id.strip():
            conditions_a.append("a.dispositivo_id = %s")
            params_a.append(dispositivo_id.strip())
        if sensor_id and sensor_id.strip():
            conditions_a.append("a.sensor_id = %s")
            params_a.append(sensor_id.strip())
        if start_utc is not None:
            conditions_a.append("a.fecha_hora >= %s")
            params_a.append(start_utc)
        if end_utc_excl is not None:
            conditions_a.append("a.fecha_hora < %s")
            params_a.append(end_utc_excl)

        where_a = f"WHERE {' AND '.join(conditions_a)}" if conditions_a else ""

        cursor.execute(
            f"""
            SELECT
              COUNT(*) AS total_alertas,
              SUM(CASE WHEN a.severidad = 'CRITICA' THEN 1 ELSE 0 END) AS criticas,
              SUM(CASE WHEN a.severidad = 'ADVERTENCIA' THEN 1 ELSE 0 END) AS advertencias,
              SUM(CASE WHEN a.estado = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
              SUM(CASE WHEN a.estado = 'ATENDIDA' THEN 1 ELSE 0 END) AS atendidas,
              SUM(CASE WHEN a.estado = 'RESUELTA' THEN 1 ELSE 0 END) AS resueltas
            FROM alertas a
            {where_a}
            """,
            tuple(params_a),
        )
        agg_alertas = cursor.fetchone() or {}

        cursor.execute(
            f"""
            SELECT
              a.id_alerta,
              a.fecha_hora,
              u.nombre AS ubicacion_nombre,
              d.nombre AS dispositivo_nombre,
              s.identificador AS sensor_identificador,
              a.severidad,
              a.estado,
              a.mensaje,
              a.causa_raiz,
              a.accion_correctiva
            FROM alertas a
            LEFT JOIN ubicaciones u ON u.ubicacion_id = a.ubicacion_id
            LEFT JOIN dispositivos d ON d.id_dispositivo = a.dispositivo_id
            LEFT JOIN sensores s ON s.id_sensor = a.sensor_id
            {where_a}
            ORDER BY a.fecha_hora DESC
            LIMIT 500
            """,
            tuple(params_a),
        )
        alertas_rows = cursor.fetchall()

        # 4. Mediciones detalladas (hasta 10,000 para volcado en hoja Mediciones)
        cursor.execute(
            f"""
            SELECT
              m.id_medicion,
              m.fecha_hora,
              u.nombre AS ubicacion_nombre,
              d.nombre AS dispositivo_nombre,
              d.codigo AS dispositivo_codigo,
              s.identificador AS sensor_identificador,
              s.modelo AS sensor_modelo,
              m.temperatura,
              m.humedad,
              m.presion,
              m.es_fuera_de_umbral,
              m.alerta_generada
            FROM mediciones m
            INNER JOIN dispositivos d ON d.id_dispositivo = m.dispositivo_id
            LEFT JOIN sensores s ON s.id_sensor = m.sensor_id
            LEFT JOIN ubicaciones u ON u.ubicacion_id = COALESCE(m.ubicacion_id, d.ubicacion_id)
            {where_m}
            ORDER BY m.fecha_hora ASC
            LIMIT 10000
            """,
            tuple(params_m),
        )
        mediciones_rows = cursor.fetchall()

    temp_count = int(agg.get("temp_count") or 0)
    hum_count = int(agg.get("hum_count") or 0)
    evaluables = int(agg.get("mediciones_evaluables") or 0)
    conformes = int(agg.get("mediciones_conformes") or 0)

    def _round_opt(val: Any) -> Optional[float]:
        return round(float(val), 2) if val is not None else None

    conformidad_pct = round((conformes / evaluables) * 100.0, 2) if evaluables > 0 else None

    # Tiempos de generación
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
    local_now = now_utc - timedelta(minutes=tz_offset_minutes)

    tz_label = get_timezone_label(tz_offset_minutes)

    # Rango formateado legible
    rango_texto = (
        f"{fecha_inicio or 'Inicio registrado'} a {fecha_fin or 'Corte actual'}"
    )

    return {
        "generacion_utc": now_utc,
        "generacion_local": local_now,
        "zona_horaria": tz_label,
        "tz_offset_minutes": tz_offset_minutes,
        "generado_por_nombre": current_user.get("nombre", "Usuario SIMOA"),
        "generado_por_rol": current_user.get("rol", "Administrador"),
        "filtros": {
            "fecha_inicio": fecha_inicio,
            "fecha_fin": fecha_fin,
            "rango_texto": rango_texto,
            "ubicacion_nombre": ubicacion_nombre,
            "dispositivo_nombre": dispositivo_nombre,
            "sensor_nombre": sensor_nombre,
            "ubicacion_id": ubicacion_id,
            "dispositivo_id": dispositivo_id,
            "sensor_id": sensor_id,
        },
        "estadisticas": {
            "total_registros": total_records,
            "desviacion_tipo": "muestral",
            "temperatura": {
                "muestras": temp_count,
                "unidad": "°C",
                "promedio": _round_opt(agg.get("temp_avg")),
                "minimo": _round_opt(agg.get("temp_min")),
                "maximo": _round_opt(agg.get("temp_max")),
                "desviacion_estandar": 0.0 if temp_count == 1 else _round_opt(agg.get("temp_std")),
            },
            "humedad": {
                "muestras": hum_count,
                "unidad": "%RH",
                "promedio": _round_opt(agg.get("hum_avg")),
                "minimo": _round_opt(agg.get("hum_min")),
                "maximo": _round_opt(agg.get("hum_max")),
                "desviacion_estandar": 0.0 if hum_count == 1 else _round_opt(agg.get("hum_std")),
            },
            "conformidad": {
                "evaluables": evaluables,
                "conformes": conformes,
                "no_conformes": evaluables - conformes,
                "porcentaje": conformidad_pct,
                "criterio": "Evaluación combinada por medición RF-07 (respetando umbrales históricos al momento de captura)",
            },
        },
        "incidencias": {
            "total_alertas": int(agg_alertas.get("total_alertas") or 0),
            "criticas": int(agg_alertas.get("criticas") or 0),
            "advertencias": int(agg_alertas.get("advertencias") or 0),
            "pendientes": int(agg_alertas.get("pendientes") or 0),
            "atendidas": int(agg_alertas.get("atendidas") or 0),
            "resueltas": int(agg_alertas.get("resueltas") or 0),
            "criterio": "Alertas generadas durante el período evaluado coincidentes con los filtros seleccionados",
            "alertas_detalle": alertas_rows,
        },
        "mediciones_detalle": mediciones_rows,
    }


def generate_environmental_pdf(data: Dict[str, Any]) -> bytes:
    """Genera documento PDF formal de Reporte Ambiental SIMOA."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Estilos tipográficos
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=3,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#0284C7"),
        spaceAfter=12,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#334155"),
    )
    bold_body = ParagraphStyle(
        "BoldBody",
        parent=body_style,
        fontName="Helvetica-Bold",
    )
    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=body_style,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#475569"),
    )

    story = []

    # 1. Encabezado con logotipo institucional si está disponible
    logo_path = os.path.abspath(os.path.join(os.getcwd(), "public", "assets", "images", "simoa-logo.png"))
    header_data = []
    if os.path.exists(logo_path):
        try:
            logo_img = Image(logo_path, width=1.4 * inch, height=0.48 * inch)
            header_text = [
                Paragraph("<b>SISTEMA IoT DE MONITOREO AMBIENTAL · SIMOA</b>", title_style),
                Paragraph("Reporte Consolidado de Calidad y Conformidad Ambiental (RF-16 / RN-18)", subtitle_style),
            ]
            header_table = Table([[logo_img, header_text]], colWidths=[1.6 * inch, 5.8 * inch])
            header_table.setStyle(
                TableStyle([
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ])
            )
            story.append(header_table)
        except Exception:
            story.append(Paragraph("<b>SISTEMA IoT DE MONITOREO AMBIENTAL · SIMOA</b>", title_style))
            story.append(Paragraph("Reporte Consolidado de Calidad y Conformidad Ambiental (RF-16 / RN-18)", subtitle_style))
    else:
        story.append(Paragraph("<b>SISTEMA IoT DE MONITOREO AMBIENTAL · SIMOA</b>", title_style))
        story.append(Paragraph("Reporte Consolidado de Calidad y Conformidad Ambiental (RF-16 / RN-18)", subtitle_style))

    story.append(Spacer(1, 4))

    # 2. Bloque de Metadatos y Filtros Aplicados (RN-18)
    f = data["filtros"]
    meta_table_data = [
        [
            Paragraph("<b>Fecha de Generación:</b>", meta_label),
            Paragraph(f"{data['generacion_local'].strftime('%Y-%m-%d %H:%M:%S')} ({data['zona_horaria']})", body_style),
            Paragraph("<b>Generado por:</b>", meta_label),
            Paragraph(f"{data['generado_por_nombre']} ({data['generado_por_rol']})", body_style),
        ],
        [
            Paragraph("<b>Período Evaluado:</b>", meta_label),
            Paragraph(f"{f['rango_texto']}", body_style),
            Paragraph("<b>Total Mediciones:</b>", meta_label),
            Paragraph(f"{data['estadisticas']['total_registros']:,} registros analizados", bold_body),
        ],
        [
            Paragraph("<b>Ubicación / Recinto:</b>", meta_label),
            Paragraph(f"{f['ubicacion_nombre']}", body_style),
            Paragraph("<b>Dispositivo / Sensor:</b>", meta_label),
            Paragraph(f"{f['dispositivo_nombre']} · {f['sensor_nombre']}", body_style),
        ],
    ]
    meta_table = Table(meta_table_data, colWidths=[1.4 * inch, 2.5 * inch, 1.4 * inch, 2.1 * inch])
    meta_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # 3. Estadísticas Descriptivas (Coincidencia exacta con RF-10)
    story.append(Paragraph("1. Resumen Estadístico de Variables Ambientales", section_heading))
    st = data["estadisticas"]
    t = st["temperatura"]
    h = st["humedad"]

    def fmt_num(v, unit=""):
        return f"{v:.2f} {unit}".strip() if v is not None else "—"

    stats_table_data = [
        [
            Paragraph("<b>Variable</b>", bold_body),
            Paragraph("<b>Muestras</b>", bold_body),
            Paragraph("<b>Promedio</b>", bold_body),
            Paragraph("<b>Mínimo</b>", bold_body),
            Paragraph("<b>Máximo</b>", bold_body),
            Paragraph("<b>Desv. Estándar (Muestral)</b>", bold_body),
            Paragraph("<b>Unidad</b>", bold_body),
        ],
        [
            Paragraph("Temperatura", body_style),
            Paragraph(f"{t['muestras']:,}", body_style),
            Paragraph(fmt_num(t['promedio']), body_style),
            Paragraph(fmt_num(t['minimo']), body_style),
            Paragraph(fmt_num(t['maximo']), body_style),
            Paragraph(fmt_num(t['desviacion_estandar']), body_style),
            Paragraph(t['unidad'], body_style),
        ],
        [
            Paragraph("Humedad Relativa", body_style),
            Paragraph(f"{h['muestras']:,}", body_style),
            Paragraph(fmt_num(h['promedio']), body_style),
            Paragraph(fmt_num(h['minimo']), body_style),
            Paragraph(fmt_num(h['maximo']), body_style),
            Paragraph(fmt_num(h['desviacion_estandar']), body_style),
            Paragraph(h['unidad'], body_style),
        ],
    ]
    stats_table = Table(stats_table_data, colWidths=[1.4 * inch, 0.9 * inch, 0.9 * inch, 0.9 * inch, 0.9 * inch, 1.6 * inch, 0.8 * inch])
    stats_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ])
    )
    # Cambiar estilos de párrafos del header para que sean blancos
    for col_idx in range(len(stats_table_data[0])):
        stats_table_data[0][col_idx].style.textColor = colors.white
    story.append(stats_table)
    story.append(Spacer(1, 10))

    # 4. Bloque de Conformidad Ambiental (SLA de Calidad de Ambiente)
    story.append(Paragraph("2. Tasa de Conformidad y Cumplimiento de Umbrales (RF-07 / RF-12)", section_heading))
    c = st["conformidad"]
    conf_pct_str = f"{c['porcentaje']:.2f} %" if c["porcentaje"] is not None else "No disponible"
    conf_color = colors.HexColor("#16A34A") if (c["porcentaje"] or 0) >= 90 else colors.HexColor("#D97706")

    conf_table_data = [
        [
            Paragraph(f"<b>Índice de Conformidad Ambiental:</b> <font color='{conf_color.hexval()}'><b>{conf_pct_str}</b></font>", bold_body),
            Paragraph(f"<b>Mediciones Evaluables:</b> {c['evaluables']:,}", body_style),
            Paragraph(f"<b>Mediciones Conformes:</b> {c['conformes']:,}", body_style),
            Paragraph(f"<b>Fuera de Umbral:</b> {c['no_conformes']:,}", body_style),
        ],
    ]
    conf_table = Table(conf_table_data, colWidths=[2.5 * inch, 1.7 * inch, 1.7 * inch, 1.5 * inch])
    conf_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4") if (c["porcentaje"] or 0) >= 90 else colors.HexColor("#FFFBEB")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#BBF7D0") if (c["porcentaje"] or 0) >= 90 else colors.HexColor("#FDE68A")),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(conf_table)
    story.append(Spacer(1, 3))
    story.append(Paragraph(f"<font color='#64748B' size='7.5'><i>Criterio aplicado: {c['criterio']}. Las mediciones inválidas o sin umbrales definidos quedan excluidas del denominador.</i></font>", body_style))
    story.append(Spacer(1, 10))

    # 5. Resumen de Incidencias y Alertas (RF-14)
    story.append(Paragraph("3. Resumen de Incidencias Operativas y Alertas (RF-14)", section_heading))
    inc = data["incidencias"]
    inc_table_data = [
        [
            Paragraph("<b>Total Alertas</b>", bold_body),
            Paragraph("<b>Críticas</b>", bold_body),
            Paragraph("<b>Advertencias</b>", bold_body),
            Paragraph("<b>Pendientes</b>", bold_body),
            Paragraph("<b>Atendidas</b>", bold_body),
            Paragraph("<b>Resueltas</b>", bold_body),
        ],
        [
            Paragraph(f"<b>{inc['total_alertas']}</b>", bold_body),
            Paragraph(f"<font color='#DC2626'><b>{inc['criticas']}</b></font>", bold_body),
            Paragraph(f"<font color='#D97706'><b>{inc['advertencias']}</b></font>", bold_body),
            Paragraph(f"{inc['pendientes']}", body_style),
            Paragraph(f"{inc['atendidas']}", body_style),
            Paragraph(f"{inc['resueltas']}", body_style),
        ],
    ]
    inc_table = Table(inc_table_data, colWidths=[1.3 * inch, 1.2 * inch, 1.3 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch])
    inc_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ])
    )
    story.append(inc_table)
    story.append(Spacer(1, 8))

    # Tabla de las alertas más recientes (hasta 10)
    alerts_list = inc.get("alertas_detalle", [])
    if alerts_list:
        story.append(Paragraph("<b>Detalle de Incidencias Registradas en el Período:</b>", meta_label))
        story.append(Spacer(1, 3))
        alert_rows_data = [
            [
                Paragraph("<b>Fecha/Hora</b>", bold_body),
                Paragraph("<b>Recinto</b>", bold_body),
                Paragraph("<b>Severidad</b>", bold_body),
                Paragraph("<b>Estado</b>", bold_body),
                Paragraph("<b>Mensaje / Causa</b>", bold_body),
            ]
        ]
        for a in alerts_list[:12]:
            fecha_str = a["fecha_hora"].strftime("%Y-%m-%d %H:%M") if hasattr(a["fecha_hora"], "strftime") else str(a["fecha_hora"])[:16]
            sev_col = "#DC2626" if a["severidad"] == "CRITICA" else "#D97706"
            msg = a["mensaje"]
            if a.get("causa_raiz"):
                msg += f" | Causa: {a['causa_raiz']}"
            alert_rows_data.append([
                Paragraph(fecha_str, body_style),
                Paragraph(a.get("ubicacion_nombre") or "—", body_style),
                Paragraph(f"<font color='{sev_col}'><b>{a['severidad']}</b></font>", body_style),
                Paragraph(a.get("estado") or "—", body_style),
                Paragraph(msg, body_style),
            ])
        alert_detail_table = Table(alert_rows_data, colWidths=[1.1 * inch, 1.2 * inch, 0.9 * inch, 0.9 * inch, 3.3 * inch])
        alert_detail_table.setStyle(
            TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
                ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ])
        )
        story.append(alert_detail_table)
    else:
        story.append(Paragraph("<font color='#16A34A'><i>No se registraron alertas ni incidencias operativas en el período analizado.</i></font>", body_style))

    doc.build(story, canvasmaker=NumberedCanvas)
    buf.seek(0)
    return buf.getvalue()


def generate_environmental_excel(data: Dict[str, Any]) -> bytes:
    """Genera libro Excel (.xlsx) estructurado con 3 hojas: Resumen, Mediciones y Alertas."""
    wb = Workbook()

    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    title_font = Font(name="Calibri", size=14, bold=True, color="0F172A")
    subtitle_font = Font(name="Calibri", size=10, italic=True, color="475569")
    bold_font = Font(name="Calibri", size=10, bold=True, color="0F172A")
    regular_font = Font(name="Calibri", size=10, color="1E293B")
    
    header_fill = PatternFill(start_color="10213D", end_color="10213D", fill_type="solid")
    alt_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    accent_fill = PatternFill(start_color="E0F2FE", end_color="E0F2FE", fill_type="solid")
    success_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")

    thin_border = Border(
        left=Side(style="thin", color="CBD5E1"),
        right=Side(style="thin", color="CBD5E1"),
        top=Side(style="thin", color="CBD5E1"),
        bottom=Side(style="thin", color="CBD5E1"),
    )

    # ==========================
    # HOJA 1: RESUMEN
    # ==========================
    ws_resumen = wb.active
    ws_resumen.title = "Resumen"
    ws_resumen.views.sheetView[0].showGridLines = True

    f = data["filtros"]
    st = data["estadisticas"]
    c = st["conformidad"]
    inc = data["incidencias"]

    ws_resumen["A1"] = "SISTEMA IoT DE MONITOREO AMBIENTAL (SIMOA)"
    ws_resumen["A1"].font = title_font
    ws_resumen["A2"] = "Reporte Consolidado de Calidad y Conformidad Ambiental (RF-16 / RN-18)"
    ws_resumen["A2"].font = subtitle_font

    # Metadatos del Reporte
    meta_rows = [
        ("Fecha de Generación (Local)", f"{data['generacion_local'].strftime('%Y-%m-%d %H:%M:%S')} ({data['zona_horaria']})"),
        ("Fecha de Generación (UTC)", data["generacion_utc"].strftime("%Y-%m-%d %H:%M:%S UTC")),
        ("Generado por", f"{data['generado_por_nombre']} ({data['generado_por_rol']})"),
        ("Rango de Fechas Evaluado", f["rango_texto"]),
        ("Ubicación / Recinto", f["ubicacion_nombre"]),
        ("Dispositivo", f["dispositivo_nombre"]),
        ("Sensor", f["sensor_nombre"]),
        ("Total Mediciones Analizadas", data["estadisticas"]["total_registros"]),
    ]

    r = 4
    ws_resumen.cell(row=r, column=1, value="PARÁMETROS DEL REPORTE").font = bold_font
    ws_resumen.cell(row=r, column=1).fill = accent_fill
    ws_resumen.cell(row=r, column=2, value="VALOR").font = bold_font
    ws_resumen.cell(row=r, column=2).fill = accent_fill
    r += 1

    for label, val in meta_rows:
        c1 = ws_resumen.cell(row=r, column=1, value=label)
        c2 = ws_resumen.cell(row=r, column=2, value=escape_excel_value(val))
        c1.font = regular_font
        c2.font = regular_font
        c1.border = thin_border
        c2.border = thin_border
        r += 1

    r += 2
    # Tabla de Estadísticas Descriptivas
    ws_resumen.cell(row=r, column=1, value="1. ESTADÍSTICAS DESCRIPTIVAS").font = title_font
    r += 1

    headers_stats = ["Variable", "Muestras Válidas", "Promedio", "Mínimo", "Máximo", "Desviación Estándar (Muestral)", "Unidad"]
    for col_idx, h_text in enumerate(headers_stats, start=1):
        cell = ws_resumen.cell(row=r, column=col_idx, value=h_text)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    r += 1

    def write_stat_row(var_name, data_dict):
        nonlocal r
        vals = [
            var_name,
            data_dict["muestras"],
            data_dict["promedio"],
            data_dict["minimo"],
            data_dict["maximo"],
            data_dict["desviacion_estandar"],
            data_dict["unidad"],
        ]
        for col_idx, val in enumerate(vals, start=1):
            cell = ws_resumen.cell(row=r, column=col_idx, value=val)
            cell.font = regular_font
            cell.border = thin_border
            if col_idx in (2, 3, 4, 5, 6):
                cell.alignment = Alignment(horizontal="right")
                if col_idx >= 3 and col_idx <= 6 and isinstance(val, (int, float)):
                    cell.number_format = "#,##0.00"
            elif col_idx == 7:
                cell.alignment = Alignment(horizontal="center")
        r += 1

    write_stat_row("Temperatura", st["temperatura"])
    write_stat_row("Humedad Relativa", st["humedad"])

    r += 2
    # Bloque de Conformidad Ambiental
    ws_resumen.cell(row=r, column=1, value="2. CONFORMIDAD AMBIENTAL Y CUMPLIMIENTO (RF-07 / RF-12)").font = title_font
    r += 1

    conf_pct = c["porcentaje"]
    conf_rows = [
        ("Índice de Conformidad Ambiental (%)", f"{conf_pct:.2f} %" if conf_pct is not None else "No disponible"),
        ("Mediciones Evaluables", c["evaluables"]),
        ("Mediciones Conformes", c["conformes"]),
        ("Mediciones Fuera de Umbral", c["no_conformes"]),
        ("Criterio de Evaluación", c["criterio"]),
    ]
    for label, val in conf_rows:
        c1 = ws_resumen.cell(row=r, column=1, value=label)
        c2 = ws_resumen.cell(row=r, column=2, value=escape_excel_value(val))
        c1.font = bold_font if "Índice" in label else regular_font
        c2.font = bold_font if "Índice" in label else regular_font
        c1.border = thin_border
        c2.border = thin_border
        if "Índice" in label and conf_pct is not None and conf_pct >= 90:
            c1.fill = success_fill
            c2.fill = success_fill
        r += 1

    r += 2
    # Resumen de Incidencias y Alertas
    ws_resumen.cell(row=r, column=1, value="3. RESUMEN DE INCIDENCIAS Y ALERTAS (RF-14)").font = title_font
    r += 1

    headers_inc = ["Total Alertas", "Críticas", "Advertencias", "Pendientes", "Atendidas", "Resueltas"]
    for col_idx, h_text in enumerate(headers_inc, start=1):
        cell = ws_resumen.cell(row=r, column=col_idx, value=h_text)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border
    r += 1

    inc_vals = [
        inc["total_alertas"],
        inc["criticas"],
        inc["advertencias"],
        inc["pendientes"],
        inc["atendidas"],
        inc["resueltas"],
    ]
    for col_idx, val in enumerate(inc_vals, start=1):
        cell = ws_resumen.cell(row=r, column=col_idx, value=val)
        cell.font = bold_font
        cell.alignment = Alignment(horizontal="center")
        cell.border = thin_border
    r += 1

    # Ajuste automático de ancho de columnas en Resumen
    for col in ws_resumen.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws_resumen.column_dimensions[col_letter].width = max(max_len + 3, 14)

    # ==========================
    # HOJA 2: MEDICIONES
    # ==========================
    ws_med = wb.create_sheet(title="Mediciones")
    ws_med.views.sheetView[0].showGridLines = True

    headers_med = [
        "ID Medición",
        "Fecha/Hora (Local)",
        "Fecha/Hora (UTC)",
        "Ubicación / Recinto",
        "Dispositivo",
        "Código Dispositivo",
        "Sensor",
        "Temperatura (°C)",
        "Humedad (%RH)",
        "Presión (hPa)",
        "Estado Evaluación",
        "Alerta Disparada",
    ]
    for col_idx, h_text in enumerate(headers_med, start=1):
        cell = ws_med.cell(row=1, column=col_idx, value=h_text)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    tz_offset_min = data["tz_offset_minutes"]
    for row_idx, m in enumerate(data.get("mediciones_detalle", []), start=2):
        dt_utc = m["fecha_hora"]
        if hasattr(dt_utc, "strftime"):
            dt_local = dt_utc - timedelta(minutes=tz_offset_min)
            dt_local_str = dt_local.strftime("%Y-%m-%d %H:%M:%S")
            dt_utc_str = dt_utc.strftime("%Y-%m-%d %H:%M:%S")
        else:
            dt_local_str = str(dt_utc)
            dt_utc_str = str(dt_utc)

        eval_str = (
            "No evaluable"
            if m.get("es_fuera_de_umbral") is None
            else ("Fuera de umbral" if bool(m.get("es_fuera_de_umbral")) else "Conforme")
        )

        vals = [
            escape_excel_value(str(m["id_medicion"])),
            dt_local_str,
            dt_utc_str,
            escape_excel_value(m.get("ubicacion_nombre") or ""),
            escape_excel_value(m.get("dispositivo_nombre") or ""),
            escape_excel_value(m.get("dispositivo_codigo") or ""),
            escape_excel_value(f"{m.get('sensor_modelo') or ''} - {m.get('sensor_identificador') or ''}".strip(" -")),
            float(m["temperatura"]) if m.get("temperatura") is not None else None,
            float(m["humedad"]) if m.get("humedad") is not None else None,
            float(m["presion"]) if m.get("presion") is not None else None,
            eval_str,
            "SÍ" if m.get("alerta_generada") else "NO",
        ]
        for col_idx, val in enumerate(vals, start=1):
            cell = ws_med.cell(row=row_idx, column=col_idx, value=val)
            cell.font = regular_font
            cell.border = thin_border
            if row_idx % 2 == 1:
                cell.fill = alt_fill
            if col_idx in (8, 9, 10):
                cell.alignment = Alignment(horizontal="right")
                if isinstance(val, (int, float)):
                    cell.number_format = "#,##0.00"
            elif col_idx in (11, 12):
                cell.alignment = Alignment(horizontal="center")

    for col in ws_med.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = max(len(str(cell.value or "")) for cell in col[:100])
        ws_med.column_dimensions[col_letter].width = max(max_len + 3, 12)

    # ==========================
    # HOJA 3: ALERTAS
    # ==========================
    ws_alt = wb.create_sheet(title="Alertas")
    ws_alt.views.sheetView[0].showGridLines = True

    headers_alt = [
        "ID Alerta",
        "Fecha/Hora (Local)",
        "Fecha/Hora (UTC)",
        "Ubicación",
        "Dispositivo",
        "Sensor",
        "Severidad",
        "Estado",
        "Mensaje",
        "Causa Raíz",
        "Acción Correctiva",
    ]
    for col_idx, h_text in enumerate(headers_alt, start=1):
        cell = ws_alt.cell(row=1, column=col_idx, value=h_text)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = thin_border

    for row_idx, a in enumerate(data.get("incidencias", {}).get("alertas_detalle", []), start=2):
        dt_utc = a["fecha_hora"]
        if hasattr(dt_utc, "strftime"):
            dt_local = dt_utc - timedelta(minutes=tz_offset_min)
            dt_local_str = dt_local.strftime("%Y-%m-%d %H:%M:%S")
            dt_utc_str = dt_utc.strftime("%Y-%m-%d %H:%M:%S")
        else:
            dt_local_str = str(dt_utc)
            dt_utc_str = str(dt_utc)

        vals = [
            escape_excel_value(str(a["id_alerta"])),
            dt_local_str,
            dt_utc_str,
            escape_excel_value(a.get("ubicacion_nombre") or ""),
            escape_excel_value(a.get("dispositivo_nombre") or ""),
            escape_excel_value(a.get("sensor_identificador") or ""),
            a.get("severidad"),
            a.get("estado"),
            escape_excel_value(a.get("mensaje") or ""),
            escape_excel_value(a.get("causa_raiz") or ""),
            escape_excel_value(a.get("accion_correctiva") or ""),
        ]
        for col_idx, val in enumerate(vals, start=1):
            cell = ws_alt.cell(row=row_idx, column=col_idx, value=val)
            cell.font = regular_font
            cell.border = thin_border
            if row_idx % 2 == 1:
                cell.fill = alt_fill
            if col_idx in (7, 8):
                cell.alignment = Alignment(horizontal="center")

    for col in ws_alt.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = max(len(str(cell.value or "")) for cell in col[:100])
        ws_alt.column_dimensions[col_letter].width = max(max_len + 3, 12)

    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return out.getvalue()
