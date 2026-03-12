# Testing scripts

Actualmente este repo no incluye la carpeta `scripts/tests/` ni los scripts manuales históricos.

## Checks disponibles

- `scripts/quality_gate.sh`: valida archivos requeridos y sintaxis JS base.
- `python scripts/mirror_sync.py check`: valida consistencia entre raíz (`/css`, `/js`, `/data`, `/index.html`) y espejo en `assets/`.
- `python scripts/mirror_sync.py sync`: sincroniza el espejo en `assets/` usando `scripts/mirror_manifest.txt`.

## Ejecución rápida

```bash
bash scripts/quality_gate.sh
python scripts/mirror_sync.py check
# opcional, para corregir desalineación:
python scripts/mirror_sync.py sync
```

## Nota

Si se reintroducen pruebas manuales o automatizadas adicionales, documentarlas aquí junto con su ruta real dentro del repositorio.
