# Workflow de organización del código

Este repositorio tiene una estructura "espejo" (`/` y `/assets`) para funcionar en distintos contextos de despliegue.

## Regla de trabajo (fuente única)

- **Fuente única de edición:** archivos en raíz (`/css`, `/js`, `/data`, `/index.html`).
- **Copia espejo:** `assets/*` se actualiza automáticamente con el script de sincronización.

## ¿Por qué?

Antes había cambios aplicados en un lado y no en el otro, lo que provocaba:

- reglas CSS del mismo componente en ubicaciones distintas,
- bugs que "regresaban" según desde qué ruta se cargara la app,
- parches superpuestos difíciles de rastrear.

## Scripts de control

### 1) Sincronizar espejo

```bash
python scripts/mirror_sync.py sync
```

Copia archivos declarados en `scripts/mirror_manifest.txt` desde raíz hacia `assets/`.

### 1.5) Regenerar manifest de personajes (cuando agregues imágenes nuevas)

```bash
python scripts/generate_parallax_manifest.py
```

Detecta automáticamente archivos en `assets/hero_layers` con patrón `<slug>_{fg|bg|mid}.<ext>` y actualiza `js/modules/parallax_manifest.js` (raíz + espejo).

### 2) Verificar consistencia

```bash
python scripts/mirror_sync.py check
```

Falla (exit code 1) si detecta diferencias entre raíz y `assets/` en archivos del manifiesto.

## Flujo obligatorio antes de commit

1. Editar solo en raíz.
2. Ejecutar `python scripts/mirror_sync.py sync`.
3. Ejecutar `python scripts/mirror_sync.py check`.
4. Ejecutar pruebas funcionales.
5. Commit.

> CI también lo valida en cada PR/push con `scripts/quality_gate.sh` (ejecuta `sync` + `check` y falla si genera diffs sin commit).


## Automatización recomendada (pre-commit)

Instala los hooks versionados del repo:

```bash
bash scripts/install_git_hooks.sh
```

Esto configura `core.hooksPath=.githooks` y ejecuta automáticamente `python scripts/mirror_sync.py sync` + `python scripts/mirror_sync.py check` en cada commit.

## Regla de mantenimiento

Si se crea un nuevo archivo duplicado entre raíz y `assets/`, agréguelo a `scripts/mirror_manifest.txt`.
