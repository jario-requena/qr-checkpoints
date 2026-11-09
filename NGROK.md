# Publicar con ngrok (desde tu PC)

1. Crea cuenta gratis en https://ngrok.com y ejecuta `ngrok config add-authtoken TU_TOKEN`.
2. Abre `start-ngrok.bat` y cambia `AUTH_USER` / `AUTH_PASS` (cuenta de administrador inicial, mín. 8 caracteres).
3. Doble clic en `start-ngrok.bat` (Mac/Linux: `bash start-ngrok.sh`).
4. Copia la URL `https://xxxx.ngrok-free.app` de la ventana de ngrok. Pulsa "Visit Site" en el aviso de ngrok e inicia sesión.

La página solo está disponible mientras tu PC y el script estén encendidos. Los datos quedan en `db/checkpoints.db`.
Las cuentas de otros usuarios se crean desde **Administrar usuarios** dentro de la página.
