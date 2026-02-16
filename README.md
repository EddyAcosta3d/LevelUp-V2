# LevelUp-V2

## Organización y consistencia de código

Para evitar reglas/logic duplicadas en lugares dispersos, el repo utiliza un flujo de **fuente única + espejo**.

- Fuente de edición: raíz del proyecto (`/css`, `/js`, `/data`, `/index.html`).
- Espejo: `assets/*`.

Comandos:

```bash
python scripts/mirror_sync.py sync
python scripts/mirror_sync.py check
```

Guía completa: `docs/CODEBASE_WORKFLOW.md`.
