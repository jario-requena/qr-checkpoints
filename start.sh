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

echo "✓ Iniciando servidor en http://localhost:3000"
echo "✓ Presiona Ctrl+C para detener"
echo ""

node server.js
