#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ ! -d "$repo_root/.git" ]; then
  echo "Este script debe ejecutarse dentro de un clon git del repositorio."
  exit 1
fi

git -C "$repo_root" config core.hooksPath .githooks

echo "Hooks instalados. Git ahora usa .githooks/"
echo "Tip: valida con 'git config --get core.hooksPath'"
