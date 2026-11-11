# PLAN: Roadmap de Desarrollo
## Sistema IoT de Monitoreo Ambiental

---

### 1. Definición del MVP vs. Iteraciones Futuras

#### 1.1 Alcance del MVP (Fase 1)
- Infraestructura base en Docker Compose (FastAPI, PostgreSQL/TimescaleDB, Mosquitto, Node-RED).
- Autenticación por Tokens JWT y RBAC inicial (Administrador y Usuario / Cliente).
- CRUD completo de Dispositivos, Sensores y Ubicaciones.
- Ingesta telemétrica vía MQTT -> Node-RED -> FastAPI -> TimescaleDB.
- Dashboard web en tiempo real con transmisión por WebSockets.
- Generación de alertas por superación de umbrales estáticos de min/máx.

#### 1.2 Iteraciones Futuras
- **Fase 2**: Integración completa del Motor de IA (Isolation Forest) para detección atípica predictiva, exportación de reportes PDF/Excel y notificaciones por correo electrónico/Push.
- **Fase 3**: Módulo avanzado de Mantenimiento Preventivo para técnicos, soporte multi-tenant escala empresarial y optimización de infraestructura para $\ge 5,000$ nodos.

---

### 2. Estructura de Hitos Secuenciales (Milestones)

#### Hito 1: Cimientos de Infraestructura y Base de Datos (Semanas 1-2)
- Configuración de repositorio Git y pipeline CI/CD.
- Despliegue del entorno Docker Compose base.
- Creación de migraciones de base de datos con Alembic (Tablas e Hypertables de TimescaleDB).

#### Hito 2: Broker MQTT, Node-RED e Ingesta Telemétrica (Semanas 3-4)
- Configuración del broker Mosquitto con seguridad TLS.
- Desarrollo de flujos en Node-RED para parsed de payloads JSON.
- Implementación de endpoints de ingesta masiva asíncrona en FastAPI.

#### Hito 3: Autenticación, Seguridad y API REST Core (Semanas 5-6)
- Implementación de autenticación JWT (login, refresh token, hashing Argon2id).
- Desarrollo de endpoints CRUD para Dispositivos, Sensores y Usuarios.
- Aplicación de políticas RLS en base de datos.

#### Hito 4: Frontend Dashboard y Comunicación WebSockets (Semanas 7-8)
- Desarrollo de la interfaz React + Tailwind CSS.
- Implementación de cliente WebSocket para streaming telemétrico sin latencia.
- Integración de gráficas de series temporales dinámicas (Recharts).

#### Hito 5: Motor de IA y Subsistema de Alertas (Semanas 9-10)
- Integración de scripts de inferencia Python (Isolation Forest & Z-Score).
- Desarrollo del motor de procesamiento de alertas con *debouncing* (5 min).
- Modales UI para notificación emergente de incidencias.

#### Hito 6: Pruebas E2E, Cobertura QA y Despliegue Staging (Semanas 11-12)
- Ejecución de suite de pruebas unitarias con Pytest y E2E con Playwright.
- Pruebas de carga simulando 500 dispositivos enviando telemetría simultánea.
- Despliegue en ambiente Staging / Producción VPS.

---

### 3. Criterios de Parada y Puertas de Calidad (Validation Gates)

Para avanzar entre hitos, se requiere cumplir las siguientes validaciones:
1. **Gate 1 (Código y Estilo)**: Cero errores reportados por `ruff` / `flake8` y linters de React.
2. **Gate 2 (Pruebas Unitarias e Integración)**: Cobertura de pruebas backend $\ge 85\%$ sin fallas activas.
3. **Gate 3 (Compilación Limpia)**: Build exitoso de contenedores Docker en el pipeline de CI/CD.
4. **Gate 4 (Human-in-the-Loop)**: Revisión y aprobación formal del Arquitecto Senior ante cada entrega de Hito.

---

### 4. Tamaño de Tareas y Granularidad

- **Micro-tareas Atómicas**: Las asignaciones en el backlog de desarrollo no deben superar un presupuesto de estimación de 4 a 8 horas de esfuerzo.
- Ejemplo: *"Crear endpoint POST /api/v1/devices para registro de nodos con validación de MAC Address"*.

---

### 5. Estrategia de Despliegue y Feedback Externo (Vibe Deploying)

- **Entorno Staging Continuo**: Despliegue automático de la rama `main` en un servidor VPS accesible mediante VPN para pruebas de usabilidad del equipo de QA.
- **Simulador de Campo**: Uso de scripts Python para emular tarjetas ESP32 reales publicando variables dinámicas de temperatura/humedad 24/7.