import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_rnf09_mosquitto_prod_configuration_security():
    """RNF-09: La configuración de producción debe prohibir anónimos y exigir MQTTS TLS 1.3 en puerto 8883."""
    conf_path = PROJECT_ROOT / "mosquitto" / "config" / "mosquitto.prod.conf"
    assert conf_path.exists(), f"El archivo {conf_path} debe existir"

    content = conf_path.read_text(encoding="utf-8")
    assert "allow_anonymous false" in content, "Debe prohibir conexiones anónimas (allow_anonymous false)"
    assert "listener 8883" in content, "Debe escuchar en el puerto seguro 8883 MQTTS"
    assert "tls_version tlsv1.3" in content, "Debe exigir TLS 1.3"
    assert "acl_file" in content, "Debe especificar un archivo de ACL"
    assert "password_file" in content, "Debe especificar un archivo de contraseñas autenticadas"


def test_rnf09_acl_configuration_least_privilege():
    """RNF-09: Las ACL deben garantizar mínimo privilegio e impedir que un nodo lea o escriba en otros."""
    acl_path = PROJECT_ROOT / "mosquitto" / "config" / "acl.conf"
    assert acl_path.exists(), f"El archivo {acl_path} debe existir"

    content = acl_path.read_text(encoding="utf-8")
    assert "pattern write simoa/dispositivos/%u/telemetria" in content, "Dispositivos restringidos a su tópico %u"
    assert "pattern write simoa/dispositivos/%u/heartbeat" in content
    assert "user simoa-backend-ingest" in content
    # Comprobar que ningún nodo ordinario tenga comodines globales de lectura o escritura
    for line in content.splitlines():
        trimmed = line.strip()
        if trimmed.startswith("pattern") and "simoa/dispositivos/+" in trimmed:
            assert False, f"Patrón no seguro con comodín encontrado para dispositivos: {trimmed}"
