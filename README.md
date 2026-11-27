# SIMOA · Sistema Inteligente de Monitoreo Ambiental (IoT)

Plataforma web de monitoreo ambiental para recintos críticos (laboratorios, bioterios, invernaderos y cadena de frío) que integra telemetría de nodos **ESP32** y sensores **DHT22 / BME280 / SHT31**, control estadístico de anomalías (**Z-Score 3σ** e **Isolation Forest**), gestión de alertas con *debouncing* de 5 minutos, diagnóstico asistido por IA y **autenticación real RF-01 con FastAPI, MySQL, bcrypt, JWT HS256 y RBAC**.

---

## Requisitos previos

- **Node.js** 20+ y **npm** 10+
- **Python** 3.11+
- **MySQL 8.4** para la base de datos. El archivo `compose.yml` permite ejecutarlo localmente con Docker Compose. El backend también conserva compatibilidad con instancias existentes de MariaDB.

---

## Configuración de Base de Datos y Entorno

1. Copia `.env.example` a `.env` en la raíz del proyecto y define tus variables reales (sin subir `.env` al repositorio):
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=simoa`
   - `JWT_SECRET_KEY` (clave aleatoria secreta de al menos 32 caracteres)
   - `ADMIN_INIT_NAME`, `ADMIN_INIT_EMAIL`, `ADMIN_INIT_PASSWORD` (mínimo 8 caracteres)
2. Ejecuta `docker compose up -d --wait` en la raíz. El servicio de MySQL escucha en `127.0.0.1` en el puerto indicado por `DB_PORT`.
3. Aplica las migraciones y crea el administrador con el comando de la sección de backend. FastAPI también ejecuta las migraciones al arrancar.

---

## Instalación y ejecución

### Arranque integrado con Docker

Desde la raíz del proyecto, ejecuta en CMD:

```cmd
if not exist .env copy .env.example .env
docker compose --profile app up -d --build --wait
```

Abre la interfaz en [localhost:3000](http://localhost:3000) y la documentación de FastAPI en [localhost:8000/docs](http://localhost:8000/docs). El frontend usa la API de Python a través del proxy de Vite. FastAPI aplica las migraciones y se conecta al mismo volumen MySQL que usa el arranque de solo base de datos.

Docker Compose guarda los registros de MySQL en el volumen `mysql-data`. Para usar un archivo de entorno de otra instalación local, indica su ruta con `docker compose --env-file` y configura `SIMOA_DOCKER_ENV_FILE` con esa misma ruta para el backend.

La primera vez, si aún no existe el administrador configurado en `.env`, créalo con `docker compose exec backend python -m app.seed_admin`. Usa `SIMOA_WEB_PORT` o `SIMOA_API_PORT` en `.env` si los puertos 3000 u 8000 están ocupados. En Docker Desktop el backend puede conectarse a un broker MQTT en el equipo anfitrión usando `SIMOA_DOCKER_MQTT_HOST=host.docker.internal`.

Los cambios guardados en ubicaciones, dispositivos, sensores, umbrales, mantenimientos y alertas se reflejan en las pantallas que consumen esos datos. La interfaz consulta `GET /api/cambios` cada 3,5 segundos mientras la pestaña está visible. MySQL publica los cambios de los catálogos al confirmar cada transacción, incluso si la modificación se hizo por SQL. El historial sigue los registros nuevos de MySQL con **Actualizar historial automáticamente**.

En desarrollo, Vite recarga los cambios de React y Uvicorn recarga los cambios de Python y de las migraciones. Si cambias las dependencias de Python o JavaScript, vuelve a ejecutar el arranque con `--build`. Para servir una compilación en el mismo origen que la API, ejecuta `npm run build` antes de iniciar FastAPI.

### 1. Backend (FastAPI + MySQL)

Desde la raíz del proyecto, ejecuta en CMD:

```cmd
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m app.seed_admin
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2. Frontend (React + Vite)

```bash
npm install
npm run dev
```

El proxy de Vite (`vite.config.ts`) redirige automáticamente `/api/*` hacia `http://localhost:8000`.

---

## API REST

Con FastAPI iniciado en el puerto 8000, abre [Swagger UI](http://127.0.0.1:8000/docs) para consultar los parámetros, cuerpos de solicitud y esquemas de respuesta. La especificación está en [OpenAPI JSON](http://127.0.0.1:8000/openapi.json).

### Autenticación y permisos

En Swagger, ejecuta `POST /api/auth/login` con tu correo y contraseña. Copia el campo `access_token`, pulsa **Authorize** y pega el token. Las peticiones por consola llevan el encabezado `Authorization: Bearer <access_token>`. Para sesiones web por cookie, las solicitudes que modifican datos deben enviar `X-CSRF-Token` con el valor de la cookie `simoa_csrf`.

| Método | Ruta | Rol o acceso | Acción |
| --- | --- | --- | --- |
| GET | `/api/health` | Público | Comprueba que la API responde. |
| GET | `/api/cambios` | Autenticado | Consulta las versiones de los datos visibles para el rol de la sesión. |
| POST | `/api/auth/login` | Público | Valida correo y contraseña, emite un JWT e inicia la sesión. |
| GET | `/api/auth/me` | Autenticado | Consulta el perfil de la sesión. |
| POST | `/api/auth/logout` | Autenticado | Revoca el JWT y cierra la sesión. |
| GET, POST | `/api/auth/users` | Administrador | Lista y crea usuarios. |

`401` indica una sesión ausente o inválida, `403` permisos insuficientes o una validación de sesión rechazada, `404` un recurso inexistente, `409` un conflicto con registros existentes y `422` datos que no cumplen el esquema.

### CRUD del inventario

| Recurso | Crear | Consultar | Actualizar | Dar de baja |
| --- | --- | --- | --- | --- |
| Ubicaciones | `POST /api/ubicaciones` | `GET /api/ubicaciones`, `GET /api/ubicaciones/{ubicacion_id}` | `PUT /api/ubicaciones/{ubicacion_id}` | `PATCH /api/ubicaciones/{ubicacion_id}/estado` con estado `INACTIVA` |
| Dispositivos | `POST /api/dispositivos` | `GET /api/dispositivos`, `GET /api/dispositivos/{id_dispositivo}` | `PUT /api/dispositivos/{id_dispositivo}` | `PATCH /api/dispositivos/{id_dispositivo}/desactivar`. `DELETE /api/dispositivos/{id_dispositivo}` aplica la regla RN-03. |
| Sensores | `POST /api/sensores` | `GET /api/sensores`, `GET /api/sensores/{id_sensor}` | `PUT /api/sensores/{id_sensor}` | `PATCH /api/sensores/{id_sensor}/estado` con estado `INACTIVO` |

Los cuatro roles pueden consultar el inventario. Las altas, actualizaciones y bajas de la tabla requieren el rol **Administrador**. El Administrador y el Técnico también pueden modificar los campos técnicos admitidos por `PATCH /api/dispositivos/{id_dispositivo}`. La baja cambia el estado y conserva el historial. `DELETE /api/dispositivos/{id_dispositivo}` aplica una baja lógica si el dispositivo carece de mediciones asociadas y devuelve `409` cuando hay historial de mediciones. Registra los recursos en el orden ubicación, dispositivo y sensor.

### Telemetría, alertas y reportes

| Método | Ruta | Acción |
| --- | --- | --- |
| GET | `/api/dispositivos/{id_dispositivo}/sensores` | Lista los sensores de un dispositivo. |
| GET | `/api/dispositivos/resumen-conectividad` | Resume el estado de conexión de los dispositivos. |
| GET | `/api/dispositivos/{id_dispositivo}/ficha-tecnica` | Consulta los datos técnicos y operativos del nodo. |
| PUT | `/api/dispositivos/{id_dispositivo}/ubicacion` | Reasigna el dispositivo a una ubicación. |
| GET | `/api/sensores/{id_sensor}/variables` | Consulta las variables habilitadas. |
| PUT | `/api/sensores/{id_sensor}/variables` | Cambia las variables habilitadas de un sensor. |
| GET, PUT | `/api/configuraciones/{sensor_id}` | Consulta o configura los umbrales. |
| GET | `/api/mediciones`, `/api/mediciones/{id_medicion}` | Consulta mediciones almacenadas en UTC. |
| GET | `/api/mediciones/historico`, `/api/mediciones/tendencias` | Consulta históricos filtrados y series temporales. |
| GET, POST | `/api/mediciones/exportar/csv` | Exporta las mediciones históricas en formato CSV. |
| GET | `/api/mediciones/stream/temperatura?conectividad=true` | Recibe eventos SSE de conectividad. |
| GET | `/api/ia/diagnostico`, `/api/ia/metricas` | Consulta diagnósticos de anomalías y métricas del modelo. |
| GET | `/api/alertas`, `/api/alertas/{alerta_id}/historial` | Consulta las alertas ambientales y su bitácora. |
| PATCH | `/api/alertas/{alerta_id}/estado` | Actualiza la atención de una alerta según las reglas del módulo. |
| GET, POST | `/api/reportes/ambientales` | Descarga reportes PDF o Excel. Disponible para Administrador y Supervisor. |
| GET, POST | `/api/mantenimientos` | Consulta intervenciones. El Administrador y el Técnico pueden registrarlas. |

---

## Pruebas automatizadas

- **Backend (`pytest` contra MySQL 8.4):** configura `DB_HOST`, `DB_PORT`, `DB_USER` y `DB_PASSWORD` para apuntar a una instancia de pruebas separada. Usa `DB_NAME=simoa` y una `JWT_SECRET_KEY` de pruebas. Las pruebas siembran y eliminan sus propios registros.
  ```bash
  .\backend\.venv\Scripts\python.exe -m pytest backend/tests/test_auth.py backend/tests/test_dispositivos_rf02.py backend/tests/test_ubicaciones_rf03.py backend/tests/test_sensores_rf04.py -q
  ```
  Cubre autenticación, revocación de JWT, control por rol y CRUD de dispositivos, ubicaciones y sensores.

- **Frontend (`npm test`, `npm run lint`, `npm run build`):**
  ```bash
  npm test
  npm run lint
  npm run build
  ```
  Cubre mapeo de roles y redirección de RF-01 junto con el motor de telemetría/anomalías (**6/6 aprobadas**, compilación sin errores).
