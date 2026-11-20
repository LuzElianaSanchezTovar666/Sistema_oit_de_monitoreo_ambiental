"""Ejecución independiente del consumidor MQTT de SIMOA (RF-06).

Permite escalar la API FastAPI con múltiples workers (--workers N y MQTT_ENABLED=false)
manteniendo una única instancia del cliente MQTT suscrita a `simoa/dispositivos/+/telemetria`.
"""

import signal
import sys
import time

from .database import run_migrations
from .services.mqtt_ingest import mqtt_service


def main() -> int:
    run_migrations()
    mqtt_service.start(wait_connect_seconds=5.0)

    running = True

    def _handle_signal(_sig, _frame) -> None:
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    try:
        while running:
            time.sleep(0.5)
    finally:
        mqtt_service.stop()

    return 0


if __name__ == "__main__":
    sys.exit(main())
