#!/bin/bash
# Usuario y contraseña para proteger la página (cámbialos)
export AUTH_USER="${AUTH_USER:-admin}"
export AUTH_PASS="${AUTH_PASS:-cambia-esta-clave}"

[ -d node_modules ] || npm install

node server.js &
SERVER_PID=$!
trap "kill $SERVER_PID" EXIT
sleep 2

echo "Abriendo túnel ngrok... copia la URL https://...ngrok-free.app"
ngrok http 3000
