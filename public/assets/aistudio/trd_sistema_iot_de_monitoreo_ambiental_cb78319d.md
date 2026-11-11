# Technical Requirements Document (TRD)
## Sistema IoT de Monitoreo Ambiental

---

### 1. Stack Tecnológico y Arquitectura de Software

#### 1.1 Stack Tecnológico
- **Frontend**: React.js 18+, Vite, Tailwind CSS, Lucide Icons, Recharts (para visualización de series temporales), WebSockets Client.
- **Backend API**: Python 3.10+, FastAPI (Asynchronous Server Gateway Interface - ASGI con Uvicorn), Pydantic v2.
- **Orquestador IoT / Middleware**: Node-RED v3.0+ (Flujos de transformación telemétrica y enrutamiento JSON).
- **Broker de Mensajería IoT**: Eclipse Mosquitto v2.0+ (MQTT v3.1.1/v5.0 con soporte TLS/MQTTS).
- **Base de Datos Principal**: PostgreSQL 15+ con extensión **TimescaleDB** (Optimizado para series temporales y datos telemétricos de hiper-escala).
- **Caché y Mensajería de Apoyo**: Redis v7.0+ (Para caché de sesiones JWT, rate limiting y pub/sub de WebSockets).
- **Motor de IA**: Python (Scikit-Learn, NumPy, SciPy) implementando modelos de **Isolation Forest** y **Z-Score dinámico**.

#### 1.2 Opciones Arquitectónicas Evaluadas

1. *Monolito Tradicional (Django / Flask)*: Descartado por cuellos de botella en la gestión asíncrona de WebSockets masivos.
2. *Microservicios Puros en Kubernetes*: Descartado por complejidad excesiva para la fase actual.
3. *Serverless (AWS Lambda + IoT Core)*: Descartado para evitar *vendor lock-in* en infraestructura de campo.
4. *Arquitectura Basada en Eventos con Kafka*: Complejidad operacional alta para el volumen proyectado de 500 nodos.
5. **Arquitectura Seleccionada: Arquitectura Modular Asíncrona Guiada por Eventos con BFF (Backend-for-Frontend)**.

```
+-------------------+      MQTT      +--------------------+      HTTP/REST      +----------------------+
| Nodos IoT / ESP32 | ------------> | Broker Mosquitto   | -----------------> | Node-RED Engine      |
+-------------------+                +--------------------+                    +----------------------+
                                                                                          |
                                                                                    HTTP/Async POST
                                                                                          v
+-------------------+   WebSockets   +--------------------+     Internal Bus    +----------------------+
| Dashboard Client  | <------------> | FastAPI (BFF API)  | <-----------------> | Engine IA & Workers  |
+-------------------+                +--------------------+                     +----------------------+
                                              |                                           |
                                       SQL / TimescaleDB                            Redis Cache
```

---

### 2. Modelo de Datos y Persistencia (ERD y Seguridad)

#### 2.1 Esquema de Base de Datos (TimescaleDB / PostgreSQL)

1. **`Rol`**: (`id_rol` PK, `nombre`, `descripcion`)
2. **`Usuario`**: (`id_usuario` PK, `nombre`, `correo`, `contraseña_hash`, `rol_id` FK, `estado`, `fecha_registro`)
3. **`RegistroAcceso`**: (`id_registro` PK, `id_usuario` FK, `fecha_hora`, `accion`, `ip`)
4. **`Ubicacion`**: (`id_ubicacion` PK, `nombre`, `descripcion`)
5. **`Dispositivo`**: (`id_dispositivo` PK, `mac_address`, `nombre`, `tipo`, `ubicacion_id` FK, `usuario_id` FK, `estado`, `fecha_registro`)
6. **`Mantenimiento`**: (`id_mantenimiento` PK, `dispositivo_id` FK, `tecnico_id` FK, `tipo_mantenimiento`, `descripcion`, `fecha_realizacion`)
7. **`Sensor`**: (`id_sensor` PK, `dispositivo_id` FK, `tipo_sensor`, `unidad_medida`, `estado`)
8. **`LimiteAmbiental`**: (`id_limite` PK, `sensor_id` FK, `tipo_variable`, `valor_min`, `valor_max`, `unidad_medida`)
9. **`Medicion`** *(Hypertable de TimescaleDB)*: (`id_medicion` PK, `sensor_id` FK, `temperatura` FLOAT, `humedad` FLOAT, `fecha_hora` TIMESTAMPTZ, `valor_anomalo` BOOLEAN)
10. **`Alerta`**: (`id_alerta` PK, `medicion_id` FK, `tipo`, `mensaje`, `nivel`, `fecha_hora`, `estado`)
11. **`Notificacion`**: (`id_notificacion` PK, `alerta_id` FK, `usuario_id` FK, `tipo`, `mensaje`, `fecha_envio`, `estado`)
12. **`HistorialIA`**: (`id_historial` PK, `medicion_id` FK, `fecha_analisis`, `resultado_score`, `detalle`)
13. **`Reporte`**: (`id_reporte` PK, `usuario_id` FK, `tipo_reporte`, `fecha_generacion`, `formato`, `contenido_url`)

#### 2.2 Políticas de Seguridad y Migraciones
- **Row Level Security (RLS)**: Aplicado en PostgreSQL para garantizar que las consultas de roles `Usuario / Cliente` estén filtradas estrictamente por `usuario_id = current_setting('app.current_user_id')`.
- **Migraciones de Esquema**: Gestionadas mediante **Alembic** en el ecosistema Python.

---

### 3. Integración de APIs y Arquitectura de Seguridad

#### 3.1 Interfaces y Protocolos
- **MQTTS (Port 8883)**: Comunicación cifrada TLS 1.3 desde los gateways/microcontroladores hacia Mosquitto.
- **REST API (HTTPS)**: Endpoints FastAPI expuestos para administración y gestión CRUD.
- **WebSockets (WSS)**: Canal dúplex de baja latencia para streaming telemétrico hacia la UI.

#### 3.2 Seguridad y Manejo de Secretos
- **Autenticación**: JSON Web Tokens (JWT) firmados con algoritmos RS256 (Llave pública/privada).
- **Hashing de Credenciales**: Argon2id con sal aleatoria por usuario.
- **Patrón BFF (Backend-for-Frontend)**: Ningún token de API externa o credencial de broker MQTT es expuesta al cliente web.
- **Secret Manager**: Uso de variables de entorno administradas vía `.env` protegidas por Docker Secrets o HashiCorp Vault.

---

### 4. Estrategia de Pruebas y Robustez de la IA

#### 4.1 Estrategia de Testing (Harness)
- **Unit Testing**: Cobertura con `pytest` para controladores de FastAPI y modelos Pydantic ($\ge 85\%$ de cobertura).
- **Integration Testing**: Validación del pipeline de ingesta simulando publicaciones MQTT con Paho-MQTT Client.
- **End-to-End (E2E)**: Pruebas automatizadas de interfaz web con **Playwright** para los flujos de login y recepción de alertas en vivo.

#### 4.2 Validación de Esquemas y Modelo de IA
- **Validación Estricta**: Definición de contratos de entrada JSON mediante `Pydantic v2 BaseSettings` en el backend.
- **Modelo de Anomalías**: Inferencia basada en el algoritmo **Isolation Forest** entrenado con ventanas móviles de 1,000 lecturas históricas por sensor, combinado con un control de límites rígidos Z-Score ($Z > 3.0$).

---

### 5. Entorno de Despliegue, DevOps y Observabilidad

#### 5.1 Infraestructura de Despliegue
- **Contenerización**: Docker y Docker Compose multi-stage para orquestar la suite:
  - Container 1: FastAPI App Engine (Uvicorn Workers)
  - Container 2: Node-RED Runtime
  - Container 3: Mosquitto MQTT Broker
  - Container 4: PostgreSQL + TimescaleDB
  - Container 5: Redis Server
  - Container 6: NGINX (Reverse Proxy & TLS Termination)

#### 5.2 Observabilidad y Telemetría
- **Logging Estructurado**: JSON Logs mediante `structlog` en Python.
- **Monitoreo de Rendimiento**: Exportación de métricas a Prometheus y visualización de salud del sistema mediante dashboards en **Grafana**.