# Product Requirements Document (PRD)
## Sistema IoT de Monitoreo Ambiental

---

### 1. El Problema y los Objetivos de Éxito (El "Porqué" de negocio)

#### 1.1 Declaración del Problema
En entornos industriales, agrícolas, laboratorios y espacios cerrados, la falta de automatización e integración telemétrica genera las siguientes falencias críticas:
- **Registros manuales discontinuos**: Pérdida de trazabilidad, sesgos humanos y vacíos de información en series temporales.
- **Respuesta tardía**: Ausencia de alertas centralizadas en tiempo real ante variaciones térmicas e higrométricas fuera de rango.
- **Enfoque puramente reactivo**: Inexistencia de mecanismos inteligentes para predecir o detectar anomalías cuantitativas antes de que resulten en la pérdida de productos o daños estructurales.
- **Heterogeneidad de dispositivos**: Dificultad para centralizar la lectura de múltiples nodos microcontroladores de campo.

#### 1.2 Propuesta de Valor
Una plataforma integral de monitoreo ambiental IoT que centraliza la ingesta telemétrica continua mediante protocolos livianos (MQTT), orquestación de flujos (Node-RED) y evaluación en tiempo real mediante algoritmos de Inteligencia Artificial en backend Python, garantizando visibilidad instantánea, alertas preventivas y trazabilidad histórica sin intervención manual.

#### 1.3 Indicadores Clave de Rendimiento (KPIs) de Negocio
- **Reducción de Tiempo de Respuesta (MTTR)**: Disminución de $\ge 80\%$ en el tiempo transcurrido desde la detección de una anomalía térmica/higrométrica hasta la notificación al usuario responsable.
- **Tasa de Cobertura Automática**: $100\%$ de las lecturas ambientales registradas e ingertadas sin pérdida de datos en transporte telemétrico.
- **Tasa de Falsos Positivos de IA**: $\le 5\%$ en las alertas emitidas por el motor predictivo de anomalías.
- **Disponibilidad Operativa**: $99.9\%$ de tiempo de actividad continuo del motor de ingesta y alertas.

---

### 2. Usuarios, Roles y Permisos (RBAC)

El sistema define cinco roles de acceso con privilegios delimitados (Role-Based Access Control):

| Rol | Descripción | Permisos de Acceso |
| :--- | :--- | :--- |
| **Administrador** | Responsable global de la plataforma e infraestructura. | Lectura/Escritura/Eliminación total sobre usuarios, dispositivos, sensores, límites ambientales, logs y configuraciones globales de IA. |
| **Técnico de Mantenimiento** | Personal encargado del soporte físico y calibración del hardware. | Lectura de topología de red, registro de intervenciones de mantenimiento y actualización de estado técnico de sensores/nodos. |
| **Supervisor** | Encargado de área/planta interesado en analítica operacional. | Lectura de paneles de monitoreo en tiempo real, exportación de reportes consolidados y gestión del estado de alertas. |
| **Usuario / Cliente** | Usuario final o propietario del espacio monitoreado. | Lectura en tiempo real del dashboard de sus dispositivos asignados, consulta de histórico de mediciones y recepción/atención de alertas. |
| **Desarrollador (Sistema)** | Ingesta telemétrica y servicios de backend automatizados. | Acceso mediante API Keys/JWT de servicio para publicación e ingesta de telemetría y ejecución de pipelines de IA. |

---

### 3. Funcionalidades Clave y Criterios de Aceptación (El "Qué" funcional)

#### Historia de Usuario #01: Alta y Asignación de Dispositivos (Administrador)
- **Como** Administrador del Sistema,
- **Quiero** registrar microcontroladores IoT (ESP32, ESP8266, Raspberry Pi) asociándolos a ubicaciones físicas y asignándolos a usuarios o clientes específicos,
- **Para** habilitar la recolección telemétrica ordenada y otorgar acceso de supervisión al cliente correspondiente.
- **Criterios de Aceptación:**
  1. El sistema valida la unicidad global de la dirección MAC del dispositivo.
  2. Al completar el alta, se generan automáticamente las credenciales de conexión MQTT (Client ID y Tópicos).
  3. Permite la vinculación directa con una entidad de `Ubicacion` y `Usuario` responsable.
  4. Muestra en el panel el estado de conexión del nodo (Online / Offline) en tiempo real.

#### Historia de Usuario #02: Configuración de Sensores y Umbrales (Administrador / Técnico)
- **Como** Administrador o Técnico de Mantenimiento,
- **Quiero** registrar y asociar sensores de temperatura/humedad (DHT11, DHT22, BME280) a un dispositivo específico y establecer umbrales operacionales,
- **Para** parametrizar las variables de medición y activar reglas de disparo de alertas.
- **Criterios de Aceptación:**
  1. Un sensor debe estar vinculado unívocamente a un dispositivo activo.
  2. Se deben definir los límites operacionales (mínimo y máximo) por variable (ej. Temp: $18^\circ\text{C} - 24^\circ\text{C}$, Humedad: $40\% - 60\%$).
  3. Las lecturas fuera de estos rangos deben etiquetarse automáticamente como eventos de superación de umbral.

#### Historia de Usuario #03: Visualización Telemétrica en Tiempo Real (Usuario / Cliente)
- **Como** Usuario / Cliente,
- **Quiero** visualizar un tablero interactivo con gráficas dinámicas de temperatura y humedad actualizadas en tiempo real,
- **Para** verificar las condiciones climáticas de mis recintos sin necesidad de recargar la pantalla.
- **Criterios de Aceptación:**
  1. Los datos se actualizan vía WebSockets o Server-Sent Events con una latencia total $\le 1\text{s}$.
  2. Permite alternar la visualización entre mediciones de temperatura ($^\circ\text{C}$) e higrométricas ($\%\text{RH}$).
  3. Las lecturas catalogadas como anómalas por el módulo de IA se resaltan visualmente mediante colores de advertencia.

#### Historia de Usuario #04: Detección Inteligente de Anomalías con IA (Administrador / Cliente)
- **Como** Usuario / Cliente o Administrador,
- **Quiero** que un modelo de IA evalúe continuamente las series de tiempo telemétricas,
- **Para** identificar picos atípicos, degradaciones persistentes o fallas del sistema de climatización de forma preventiva.
- **Criterios de Aceptación:**
  1. El análisis de inferencia por cada lectura se completa en un tiempo $\le 200\text{ms}$.
  2. Al detectarse un valor atípico (con un nivel de severidad determinado), se asigna el flag `es_anomalo = True` en el histórico de mediciones.
  3. El cálculo de IA no ralentiza ni bloquea el pipeline de ingesta de datos transaccionales.

#### Historia de Usuario #05: Gestión y Notificación de Alertas Ambientales (Todos los Roles)
- **Como** Usuario / Cliente o Supervisor,
- **Quiero** recibir notificaciones emergentes instantáneas cuando se detecten lecturas fuera de rango o anomalías de IA,
- **Para** ejecutar protocolos de contingencia inmediatos.
- **Criterios de Aceptación:**
  1. Despliegue de un modal de alerta indicando ubicación, sensor, variable alterada y nivel de severidad (Advertencia / Crítico).
  2. Permitir al usuario cambiar el estado de la alerta a 'Revisada' o 'En Atención'.
  3. Aplicar *debouncing*: lecturas consecutivas anómalas dentro de una ventana de 5 minutos sobre el mismo sensor se consolidan en un único evento de alerta.

---

### 4. Límites, Restricciones y Exclusiones (El "No")

#### 4.1 Exclusiones de Alcance (Out of Scope)
- **Actuación Física Directa**: El sistema no interactúa ni envía órdenes de control automático a actuadores físicos (servomotores, relés de climatización o válvulas).
- **Mantenimiento Físico**: No incluye la gestión logística del reemplazo físico ni reparaciones microelectrónicas en sitio.
- **Protocolos Industriales Legacy**: Queda fuera de alcance el soporte para protocolos directos como Modbus RTU o Profibus sin antes pasar por un Gateway MQTT compatible.

#### 4.2 Restricciones Técnicas Operativas
- Modificación prohibida de los componentes centrales de la biblioteca de comunicación MQTT y del core de autenticación JWT sin auditoría de seguridad previa.
- Los scripts de inferencia de IA deben ejecutarse de forma asíncrona para prevenir el bloqueo del event loop del backend.

---

### 5. Expectativas de Pruebas y Comportamientos Críticos

- **Flujo de Ingesta Bajo Carga**: Prueba de estrés que simule la transmisión simultánea de al menos 500 nodos IoT publicando mensajes JSON a $1\text{ Hz}$.
- **Recuperación ante Desconexión**: Verificación de reconexión automática del cliente MQTT en Node-RED y en los nodos ante caídas temporales de red, sin duplicar registros en base de datos.
- **Persistencia de Estado de Alertas**: Confirmación de que una alerta no atendida mantenga su estado persistente entre reinicios del cliente web.