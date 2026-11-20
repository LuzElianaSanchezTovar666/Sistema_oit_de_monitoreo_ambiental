# RF-14: Bitácora y Gestión de Eventos de Alerta

## 1. Flujo de Estados y Transiciones Permitidas
- Estados oficiales en MySQL (`alertas.estado`): `PENDIENTE` → `ATENDIDA` → `RESUELTA`.
- Transiciones válidas:
  - `PENDIENTE` → `ATENDIDA`
  - `PENDIENTE` → `RESUELTA` (sujeta a validación de acción correctiva si es `CRITICA`)
  - `ATENDIDA` → `RESUELTA`
- Transiciones rechazadas (`400 Bad Request`):
  - Cualquier modificación sobre una alerta en estado `RESUELTA`.
  - Transición hacia el mismo estado actual o retroceso `ATENDIDA` → `PENDIENTE`.
- Las alertas `CRITICA` no pueden pasar a `RESUELTA` sin describir `accion_correctiva` (validado en React y obligatoriamente en FastAPI).

## 2. Auditoría e Inmutabilidad (RN-16)
- Cada transición actualiza `alertas` y registra una fila en `historial_alertas` dentro de la misma transacción MySQL (`SELECT ... FOR UPDATE` + control de concurrencia `version`).
- El usuario responsable (`usuario_id`, `usuario_correo`, `usuario_nombre`) se toma exclusivamente de la sesión autenticada JWT/cookie.
- Triggers SQL `trg_historial_alertas_no_update` y `trg_historial_alertas_no_delete` protegen la bitácora contra modificaciones o eliminaciones no autorizadas.
- Las observaciones previas se conservan concatenando la nueva entrada con marca temporal UTC; el mensaje original de RF-13 nunca se altera.

## 3. Política del Contador de Alertas Activas y Tiempo Real
- **Política activa:** `PENDIENTE` y `ATENDIDA` cuentan como alertas activas; `RESUELTA` deja de contar.
- Abrir o visualizar el detalle de una alerta nunca reduce el contador.
- Tras confirmar el commit en MySQL, `PATCH /api/alertas/{id}/estado` emite el evento `alerta_actualizada` por `/api/alertas/stream` (SSE), actualizando en vivo el Gestor de Alertas, la barra lateral y el Dashboard.

## 4. Preparación para RF-16 y RF-20
- La tabla `alertas` (`usuario_responsable_id`, `causa_raiz`, `accion_correctiva`, `fecha_atencion`, `fecha_resolucion`) y `historial_alertas` quedan indexadas y listas para reportes/analítica (**RF-16** y **RF-20**) sin implementar dichos módulos aún.
