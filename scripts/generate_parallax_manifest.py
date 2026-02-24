#!/usr/bin/env python3
"""Generate js/modules/parallax_manifest.js from assets/hero_layers files.

Expected file patterns inside assets/hero_layers:
  <slug>_fg.<ext>
  <slug>_bg.<ext>
  <slug>_mid.<ext>  (optional)

The script writes both root and mirror copies:
  - js/modules/parallax_manifest.js
  - assets/js/modules/parallax_manifest.js
"""

from __future__ import annotations

from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
LAYERS_DIR = ROOT / 'assets' / 'hero_layers'
OUT_FILES = [
    ROOT / 'js' / 'modules' / 'parallax_manifest.js',
    ROOT / 'assets' / 'js' / 'modules' / 'parallax_manifest.js',
]

LAYER_RE = re.compile(r'^(?P<slug>[a-z0-9_\-]+)_(?P<layer>fg|bg|mid)\.(?P<ext>webp|png|jpe?g|avif)$', re.IGNORECASE)


def collect_manifest() -> dict[str, dict[str, str]]:
    entries: dict[str, dict[str, str]] = {}
    if not LAYERS_DIR.exists():
        return entries

    for file_path in sorted(LAYERS_DIR.iterdir(), key=lambda p: p.name.lower()):
        if not file_path.is_file():
            continue
        match = LAYER_RE.match(file_path.name)
        if not match:
            continue

        slug = match.group('slug').lower()
        layer = match.group('layer').lower()
        rel_path = f"assets/hero_layers/{file_path.name}"
        bucket = entries.setdefault(slug, {'fg': '', 'bg': '', 'mid': ''})
        bucket[layer] = rel_path

    return dict(sorted(entries.items(), key=lambda item: item[0]))


def render_js(manifest: dict[str, dict[str, str]]) -> str:
    payload = json.dumps(manifest, indent=2, ensure_ascii=False)
    return f"window.__PARALLAX_MANIFEST__ = {payload};\n"


def main() -> int:
    manifest = collect_manifest()
    output = render_js(manifest)

    for out_file in OUT_FILES:
        out_file.parent.mkdir(parents=True, exist_ok=True)
        out_file.write_text(output, encoding='utf-8')

    print(f'Generated parallax manifest with {len(manifest)} heroes.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
