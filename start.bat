@echo off
echo.
echo ╔════════════════════════════════════════╗
echo ║  QR CHECKPOINTS - Iniciando...         ║
echo ╚════════════════════════════════════════╝
echo.

:: Verificar si node_modules existe
if not exist "node_modules" (
  echo 📦 Instalando dependencias (primera vez)...
  call npm install
  echo.
)

echo ✓ Iniciando servidor en http://localhost:3000
echo ✓ Presiona Ctrl+C para detener
echo.

node server.js

pause
