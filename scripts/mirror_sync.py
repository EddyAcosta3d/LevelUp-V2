#!/usr/bin/env python3
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'scripts' / 'mirror_manifest.txt'


def files_from_manifest():
    lines = [ln.strip() for ln in MANIFEST.read_text(encoding='utf-8').splitlines()]
    return [ln for ln in lines if ln and not ln.startswith('#')]


def sync():
    copied = 0
    for rel in files_from_manifest():
        src = ROOT / rel
        dst = ROOT / 'assets' / rel
        if not src.exists():
            raise FileNotFoundError(f'Missing source file: {rel}')
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        copied += 1
    print(f'Synced {copied} files from root/ to assets/.')


def check():
    mismatches = []
    for rel in files_from_manifest():
        src = ROOT / rel
        dst = ROOT / 'assets' / rel
        if not src.exists() or not dst.exists():
            mismatches.append((rel, 'missing'))
            continue
        if src.read_bytes() != dst.read_bytes():
            mismatches.append((rel, 'diff'))

    if mismatches:
        print('Mirror check failed:')
        for rel, kind in mismatches:
            print(f' - {rel}: {kind}')
        return 1

    print('Mirror check passed: root/ and assets/ are aligned for all manifest files.')
    return 0


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in {'sync', 'check'}:
        print('Usage: python scripts/mirror_sync.py [sync|check]')
        sys.exit(2)

    if sys.argv[1] == 'sync':
        sync()
        sys.exit(0)

    sys.exit(check())
