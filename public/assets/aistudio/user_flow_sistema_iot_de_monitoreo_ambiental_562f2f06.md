# User Flow: Flujos de Navegación
## Sistema IoT de Monitoreo Ambiental

---

### 1. Punto de Partida y Estado Inicial (Entry Point)

#### 1.1 Primer Acceso (Usuario Anónimo)
- **Ruta de Entrada**: `https://monitoreo.iot-ambiental.com/login`
- **Interfaz**: Formulario de inicio de sesión limpio con campos para correo electrónico y contraseña.
- **Comportamiento**: Si un usuario no autenticado intenta ingresar directamente a cualquier sub-ruta (ej. `/dashboard`), el guardián de rutas (`AuthGuard`) lo redirige automáticamente a `/login`.

#### 1.2 Usuario Autenticado (Sesión Activa)
- Al validar credenciales correctamente, el backend retorna un token JWT conteniendo el ROL del usuario.
- Redirección automática según el rol:
  - **Administrador**: Redirigido a `/admin/overview` (Panel de topología global y estado de nodos).
  - **Usuario / Cliente**: Redirigido a `/client/dashboard` (Gráficas de monitoreo en tiempo real de sus espacios).

---

### 2. Happy Path / Camino Crítico Paso a Paso

#### 2.1 Flujo del Administrador: Registrar Nodo y Sensor
```
[Inicio: Panel Admin] 
       │
       ▼
[Click en "Nuevo Dispositivo"] 
       │
       ▼
[Formulario: Nombre, Ubicación, MAC Address, Cliente Asignado] 
       │
       ▼
[Validación exitosa -> Guardar] 
       │
       ▼
[Click en "Asignar Sensor"] 
       │
       ▼
[Seleccionar Tipo: DHT22 / Temp & Humedad -> Definir Umbrales] 
       │
       ▼
[Confirmar -> Generación de Credenciales MQTT] 
       │
       ▼
[Fin: Dispositivo pasa a estado 'ONLINE' al recibir primer ping]
```

#### 2.2 Flujo del Cliente: Visualización y Monitoreo en Tiempo Real
```
[Inicio: Dashboard Cliente] 
       │
       ▼
[Establecimiento de Conexión WebSocket wss://...] 
       │
       ▼
[Renderizado de tarjetas con lecturas actuales: Temp °C y Humedad %] 
       │
       ▼
[Streaming continuo de datos en gráfica de series temporales] 
       │
       ▼
[Fin: Visualización ininterrumpida sin recargar pantalla]
```

---

### 3. Bifurcaciones Lógicas y Escenarios Alternativos (Edge Cases)

#### 3.1 Escenario A: Dispositivo Pierde Conexión de Red (Offline)
- **Evento**: El broker MQTT no recibe paquetes `PINGREQ` del microcontrolador durante 3 minutos.
- **Acción del Sistema**:
  1. El backend marca la entidad `Dispositivo.estado = 'OFFLINE'`.
  2. En la UI del cliente, la tarjeta del nodo cambia su indicador de color verde a un badge gris "Desconectado".
  3. Se genera un registro de evento en la bitácora sin disparar alertas de pánico.

#### 3.2 Escenario B: Ingesta de Payload Telemétrico Corrupto
- **Evento**: Node-RED recibe un paquete JSON malformado desde un sensor dañado.
- **Acción del Sistema**:
  1. Node-RED rechaza el envío al backend de FastAPI y redirige el paquete a una cola Dead Letter Queue (DLQ).
  2. Se escribe un log de error en `structlog`.
  3. El flujo principal de ingesta no se detiene ni afecta a los demás dispositivos.

#### 3.3 Escenario C: Expiración de Sesión (JWT Expired)
- **Evento**: El token de acceso expira tras 8 horas de inactividad.
- **Acción del Sistema**:
  1. El Axios Interceptor en el cliente detecta una respuesta HTTP `401 Unauthorized`.
  2. Intenta renovar la sesión mediante la ruta `/api/v1/auth/refresh`.
  3. Si el *Refresh Token* también expiró, se limpia el almacenamiento local (`localStorage`) y se redirige con un mensaje Toast al `/login`.

---

### 4. Estados de la Interfaz (UI States)

| Pantalla | Estado Loading | Estado Vacío (Empty State) | Estado de Error / Alerta Crítica |
| :--- | :--- | :--- | :--- |
| **Dashboard en Tiempo Real** | *Skeleton Loaders* animados en el lugar de las gráficas y tarjetas. | Mensaje: *"No hay dispositivos registrados en esta ubicación. Contacte al Administrador."* | Modal emergente rojo con sonido de alerta e indicando: *"¡ALERTA CRÍTICA: Temperatura por encima de $35^\circ\text{C}$!"* |
| **Listado de Dispositivos** | Tabla con filas sombreadas en parpadeo. | Mensaje: *"Aún no has dado de alta ningún dispositivo IoT."* | Banner superior: *"Error de comunicación con el backend FastAPI."* |
| **Histórico de Mediciones** | Spinner de carga sobre el selector de fechas. | Mensaje: *"No existen lecturas registradas para el rango de fechas seleccionado."* | Notificación Toast: *"Formato de fecha inválido."* |

---

### 5. Puntos de Salida y Feedback de Cierre (Success & Loopback)

#### 5.1 Atención de Alertas por parte del Usuario
1. El cliente visualiza el modal de Alerta Crítica o Advertencia.
2. Hace clic en el botón **"Atender Alerta"**.
3. Aparece una ventana de confirmación donde puede seleccionar la causa (ej. *"Falla de aire acondicionado"*, *"Ventana abierta"*) y hacer clic en **"Resolver"**.
4. La alerta cambia su estado a `Atendida` en la base de datos, el modal se cierra y la UI muestra un Toast de confirmación verde: *"Alerta registrada y resuelta con éxito"*.

#### 5.2 Cierre de Sesión Seguro (Logout)
1. El usuario hace clic en su avatar en la esquina superior derecha y selecciona **"Cerrar Sesión"**.
2. El sistema revoca el Refresh Token en la base de datos Redis.
3. Se cierra el socket de WebSockets activo.
4. El cliente elimina los tokens del almacenamiento y lo redirige a la pantalla de Login.