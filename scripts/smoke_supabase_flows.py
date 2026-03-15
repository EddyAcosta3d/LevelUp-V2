#!/usr/bin/env python3
"""Smoke tests básicos de flujos críticos en Supabase.

Flujos cubiertos (API-level):
- Login (Auth password grant)
- Evidencias (submissions + Storage público opcional)
- Tienda (store_claims)
- Desbloqueos (hero_assignments)

Uso:
  python scripts/smoke_supabase_flows.py

Variables de entorno requeridas:
  SUPABASE_URL
  SUPABASE_ANON_KEY

Variables opcionales:
  SMOKE_EMAIL
  SMOKE_PASSWORD
  SMOKE_STORAGE_PUBLIC_PATH   (ruta dentro de bucket `evidencias/`, ej: demo/test.png)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


class SmokeFailure(RuntimeError):
    """Error de smoke test."""


def _env(name: str, required: bool = True) -> str | None:
    value = os.environ.get(name)
    if required and not value:
        raise SmokeFailure(f"Falta variable de entorno requerida: {name}")
    return value


def _request(method: str, url: str, *, headers: dict[str, str] | None = None, body: dict | None = None) -> tuple[int, str]:
    data = None
    req_headers = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")

    req = urllib.request.Request(url=url, method=method, headers=req_headers, data=data)
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            payload = res.read().decode("utf-8", errors="replace")
            return res.status, payload
    except urllib.error.HTTPError as e:
        payload = e.read().decode("utf-8", errors="replace")
        return e.code, payload
    except urllib.error.URLError as e:
        raise SmokeFailure(f"Error de red al llamar {url}: {e}") from e


def _assert_status(status: int, allowed: set[int], context: str, payload: str) -> None:
    if status not in allowed:
        snippet = payload.strip().replace("\n", " ")[:300]
        raise SmokeFailure(f"{context} falló con status={status}. Respuesta: {snippet}")


def main() -> int:
    try:
        supabase_url = _env("SUPABASE_URL")
        anon_key = _env("SUPABASE_ANON_KEY")

        base_headers = {
            "apikey": anon_key,
            "Authorization": f"Bearer {anon_key}",
        }

        print("[1/5] REST pública: submissions")
        status, payload = _request(
            "GET",
            f"{supabase_url}/rest/v1/submissions?select=id&limit=1",
            headers=base_headers,
        )
        _assert_status(status, {200, 206}, "Lectura pública submissions", payload)

        email = _env("SMOKE_EMAIL", required=False)
        password = _env("SMOKE_PASSWORD", required=False)
        access_token = None

        print("[2/5] Auth login (opcional)")
        if email and password:
            status, payload = _request(
                "POST",
                f"{supabase_url}/auth/v1/token?grant_type=password",
                headers={"apikey": anon_key},
                body={"email": email, "password": password},
            )
            _assert_status(status, {200}, "Login password", payload)
            parsed = json.loads(payload or "{}")
            access_token = parsed.get("access_token")
            if not access_token:
                raise SmokeFailure("Login exitoso pero sin access_token en respuesta")
            print("  OK: login válido")
        else:
            print("  SKIP: define SMOKE_EMAIL + SMOKE_PASSWORD para validar login real")

        if access_token:
            auth_headers = {
                "apikey": anon_key,
                "Authorization": f"Bearer {access_token}",
            }

            print("[3/5] Flujo tienda: store_claims lectura")
            status, payload = _request(
                "GET",
                f"{supabase_url}/rest/v1/store_claims?select=id&limit=1",
                headers=auth_headers,
            )
            _assert_status(status, {200, 206}, "Lectura store_claims", payload)

            print("[4/5] Flujo desbloqueos: hero_assignments lectura")
            status, payload = _request(
                "GET",
                f"{supabase_url}/rest/v1/hero_assignments?select=hero_id,challenge_id&limit=1",
                headers=auth_headers,
            )
            _assert_status(status, {200, 206}, "Lectura hero_assignments", payload)
        else:
            print("[3/5] Flujo tienda: store_claims lectura")
            print("  SKIP: requiere SMOKE_EMAIL + SMOKE_PASSWORD")
            print("[4/5] Flujo desbloqueos: hero_assignments lectura")
            print("  SKIP: requiere SMOKE_EMAIL + SMOKE_PASSWORD")

        print("[5/5] Flujo evidencias: Storage público (opcional)")
        public_path = _env("SMOKE_STORAGE_PUBLIC_PATH", required=False)
        if public_path:
            safe_path = urllib.parse.quote(public_path.lstrip("/"))
            status, payload = _request(
                "HEAD",
                f"{supabase_url}/storage/v1/object/public/evidencias/{safe_path}",
                headers={"apikey": anon_key},
            )
            _assert_status(status, {200}, "Lectura Storage público de evidencias", payload)
            print("  OK: storage público accesible")
        else:
            print("  SKIP: define SMOKE_STORAGE_PUBLIC_PATH para validar archivo público")

        print("Smoke tests Supabase: OK")
        return 0
    except SmokeFailure as e:
        print(f"ERROR: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
