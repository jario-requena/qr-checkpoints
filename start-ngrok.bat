@echo off
chcp 65001 >nul
echo.
echo ==== QR CHECKPOINTS + NGROK ====
echo.

if not exist "node_modules" (
  echo Instalando dependencias...
  call npm install
)

:: --- CUENTA DE ADMINISTRADOR INICIAL (usuario y contrasena, minimo 8 caracteres) ---
set AUTH_USER=admin
set AUTH_PASS=cambia-esta-clave
:: ---------------------------------------------

echo Iniciando servidor en una ventana aparte...
start "QR Server" cmd /k node server.js

timeout /t 3 >nul
echo Abriendo tunel ngrok (copia la URL https://...ngrok-free.app que aparece)
ngrok http 3000
