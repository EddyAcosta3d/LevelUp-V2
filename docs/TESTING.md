# Testing scripts

Actualmente este repo no incluye la carpeta `scripts/tests/` ni los scripts manuales históricos.

## Checks disponibles

- `scripts/quality_gate.sh`: valida archivos requeridos, ejecuta `sync` + `check` del espejo y falla si quedaron diffs sin commit, además de validar sintaxis JS.
- `python scripts/mirror_sync.py check`: valida consistencia entre raíz (`/css`, `/js`, `/data`, `/index.html`) y espejo en `assets/`.
- `python scripts/mirror_sync.py sync`: sincroniza el espejo en `assets/` usando `scripts/mirror_manifest.txt`.

## Ejecución rápida

```bash
bash scripts/quality_gate.sh
python scripts/mirror_sync.py check
# opcional, para corregir desalineación:
python scripts/mirror_sync.py sync
```

## Smoke tests de flujos críticos (Supabase)

Script: `python scripts/smoke_supabase_flows.py`

Cubre checks básicos de:
- login (`auth/v1/token`),
- evidencias (`submissions` y `storage` público opcional),
- tienda (`store_claims`),
- desbloqueos (`hero_assignments`).

Variables requeridas:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Variables opcionales:
- `SMOKE_EMAIL` + `SMOKE_PASSWORD` (activa login real por password),
- `SMOKE_STORAGE_PUBLIC_PATH` (valida lectura de evidencia pública).

En GitHub Actions existe el workflow `Smoke Supabase Flows` (`.github/workflows/smoke-supabase.yml`).

## Nota

Si se reintroducen pruebas manuales o automatizadas adicionales, documentarlas aquí junto con su ruta real dentro del repositorio.
