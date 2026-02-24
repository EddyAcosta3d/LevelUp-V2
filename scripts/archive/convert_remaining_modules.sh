#!/bin/bash
# Script para convertir módulos restantes a ES6

echo "🔄 Convirtiendo módulos restantes a ES6..."

# Array de módulos a convertir
MODULES=(
  "desafios"
  "eventos"
  "tienda"
  "app_actions"
)

for module in "${MODULES[@]}"; do
  FILE="js/modules/${module}.js"

  if [ ! -f "$FILE" ]; then
    echo "❌ No se encontró $FILE"
    continue
  fi

  echo "Processing $module.js..."

  # Agregar exports a funciones públicas (NO privadas con _)
  sed -i 's/^function \([^_]\)/export function \1/g' "$FILE"
  sed -i 's/^  function \([^_]\)/  export function \1/g' "$FILE"

  echo "✅ $module.js convertido"
done

echo "✨ Conversión completada"
