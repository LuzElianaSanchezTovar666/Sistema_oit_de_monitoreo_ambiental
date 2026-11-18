# SIMOA · Sistema Inteligente de Monitoreo Ambiental (IoT)

Plataforma web de monitoreo ambiental para recintos críticos (laboratorios, bioterios, invernaderos y cadena de frío) que integra telemetría de nodos **ESP32** y sensores **DHT22 / BME280 / SHT31**, control estadístico de anomalías (**Z-Score 3σ** e **Isolation Forest**), gestión de alertas con *debouncing* de 5 minutos, diagnóstico asistido por IA y **autenticación real RF-01 con FastAPI, MySQL, bcrypt, JWT HS256 y RBAC**.

---

## Requisitos previos

- **Node.js** 20+ y **npm** 10+
- **Python** 3.11+
- **MySQL 8 / MariaDB 10.4+** en ejecución (por ejemplo vía XAMPP en `127.0.0.1:3306`)

---

## Configuración de Base de Datos y Entorno

1. Inicia MySQL / MariaDB en tu entorno local (puerto `3306`).
2. Copia `.env.example` a `.env` en la raíz del proyecto y define tus variables reales (sin subir `.env` al repositorio):
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=simoa`
   - `JWT_SECRET_KEY` (clave aleatoria secreta de al menos 32 caracteres)
   - `ADMIN_INIT_NAME`, `ADMIN_INIT_EMAIL`, `ADMIN_INIT_PASSWORD` (mínimo 8 caracteres)
3. Las tablas (`usuarios` y `revoked_tokens`) se crean automáticamente al iniciar el backend mediante `backend/migrations/001_create_auth_tables.sql`.

---

## Instalación y ejecución

### 1. Backend (FastAPI + MySQL)

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\pip.exe install -r requirements.txt

# Registrar el primer Administrador desde variables de entorno (.env):
.\.venv\Scripts\python.exe -m app.seed_admin

# Iniciar API FastAPI en el puerto 8000:
.\.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend (React + Vite)

```bash
npm install
npm run dev
```

El proxy de Vite (`vite.config.ts`) redirige automáticamente `/api/*` hacia `http://localhost:8000`.

---

## Endpoints de Autenticación y RBAC (RF-01)

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Público (rate-limited) | Valida correo y contraseña con `bcrypt`, emite JWT HS256 (8 h) en cookie `HttpOnly` + JSON y cookie CSRF. |
| `GET` | `/api/auth/me` | Autenticado | Devuelve el perfil del usuario activo desde MySQL. |
| `POST` | `/api/auth/logout` | Autenticado | Revoca el `jti` del token en `revoked_tokens` (MySQL) y limpia cookies. |
| `GET` / `POST` | `/api/auth/users` | `Administrador` | Lista y crea usuarios validando mínimo 8 caracteres (RN-01) y hash `bcrypt` (RN-03). |
| `GET` | `/api/dashboard/summary` | Todos los roles | Resumen y módulos autorizados para el rol autenticado. |
| `POST` | `/api/devices` | `Administrador` | Registro de dispositivos IoT. |
| `PATCH` | `/api/devices/{id}/technical` | `Administrador`, `Técnico` | Actualización técnica de dispositivos. |
| `GET` | `/api/measurements` | Todos los roles | Consulta de mediciones ambientales. |
| `GET` | `/api/alerts` | `Administrador`, `Operador`, `Supervisor` | Consulta de alertas. |
| `PUT` | `/api/alerts/config` | `Administrador` | Configuración de umbrales de alerta. |
| `GET` | `/api/reports/summary` | `Administrador`, `Supervisor` | Consulta de reportes e indicadores. |

---

## Pruebas automatizadas

- **Backend (`pytest` contra MySQL real):**
  ```bash
  .\backend\.venv\Scripts\pytest.exe backend\tests\test_auth.py -v
  ```
  Cubre login exitoso (JWT 8h + cookie HttpOnly), contraseña incorrecta, correo inexistente, usuario inactivo, acceso sin token, token inválido, token vencido, consulta de perfil `/me`, RBAC por rol y revocación en `/logout` (**11/11 aprobadas**).

- **Frontend (`npm test`, `npm run lint`, `npm run build`):**
  ```bash
  npm test
  npm run lint
  npm run build
  ```
  Cubre mapeo de roles y redirección de RF-01 junto con el motor de telemetría/anomalías (**6/6 aprobadas**, compilación sin errores).
