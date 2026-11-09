#!/bin/bash

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  QR CHECKPOINTS - Iniciando...         ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Verificar si node_modules existe
if [ ! -d "node_modules" ]; then
  echo "📦 Instalando dependencias (primera vez)..."
  npm install
  echo ""
fi

# Administrador inicial (solo se usa la primera vez que se crea la base de datos). CAMBIA la clave.
export AUTH_USER="${AUTH_USER:-admin}"
export AUTH_PASS="${AUTH_PASS:-cambia-esta-clave}"

echo "✓ Iniciando servidor en http://localhost:3000"
echo "✓ Presiona Ctrl+C para detener"
echo ""

node server.js
