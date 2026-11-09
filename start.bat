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

:: Administrador inicial (solo se usa la primera vez que se crea la base de datos). CAMBIA la clave.
if not defined AUTH_USER set AUTH_USER=admin
if not defined AUTH_PASS set AUTH_PASS=cambia-esta-clave

echo ✓ Iniciando servidor en http://localhost:3000
echo ✓ Presiona Ctrl+C para detener
echo.

node server.js

pause
