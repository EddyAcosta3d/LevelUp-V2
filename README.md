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

## Chequeo rápido de Supabase (sin abrir la app)

Puedes validar que el proyecto está hablando bien con Supabase usando estos checks:

1. **Confirmar que URL y anon key estén presentes en el cliente** (`js/modules/supabase_client.js`).
2. **Probar lectura REST pública** (debe responder 200 o 206 según filtros/RLS):

   ```bash
   curl -i 'https://nptbobvstfjpytnvzfil.supabase.co/rest/v1/submissions?select=id&limit=1' \
     -H 'apikey: <SUPABASE_ANON_KEY>' \
     -H 'Authorization: Bearer <SUPABASE_ANON_KEY>'
   ```

3. **Probar Auth** (si tienes usuario de prueba) con login por password:

   ```bash
   curl -i 'https://nptbobvstfjpytnvzfil.supabase.co/auth/v1/token?grant_type=password' \
     -H 'apikey: <SUPABASE_ANON_KEY>' \
     -H 'Content-Type: application/json' \
     -d '{"email":"<EMAIL>","password":"<PASSWORD>"}'
   ```

4. **Validar Storage** leyendo un archivo público esperado:

   ```bash
   curl -I 'https://nptbobvstfjpytnvzfil.supabase.co/storage/v1/object/public/evidencias/<ruta_del_archivo>'
   ```

5. **Diagnóstico de RLS**: si REST responde `401`/`403`, revisa políticas RLS y que el token no haya expirado.

### Señales de que está sano

- No hay errores `Failed to fetch` en consola del navegador.
- Las llamadas de `submissions`, `store_claims` y `hero_assignments` responden sin `401/403` inesperados.
- Si el token expira, el cliente lo renueva y reintenta automáticamente.


## Si Security Advisor marca errores/warnings

Para los errores que muestras en Supabase (`RLS Disabled in Public` y `RLS Policy Always True`), ejecuta en SQL Editor:

```sql
-- Archivo recomendado del repo:
-- docs/supabase_security_advisor_fixes.sql
```

Ese script:
- habilita RLS en `hero_accounts`, `hero_assignments`, `submissions` y `store_claims`;
- elimina políticas antiguas/permisivas;
- crea políticas por rol efectivo (admin por email + alumno por `hero_id` propio).

Además, para `Leaked Password Protection Disabled`:
1. Ve a **Auth → Providers → Email**.
2. Activa **Leaked password protection**.
3. Guarda cambios.
