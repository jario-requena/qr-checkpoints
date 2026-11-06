# Publicar QR Checkpoints con ngrok

## Una sola vez
1. Crea cuenta gratis en https://ngrok.com y descarga ngrok.
2. Conecta tu cuenta (token en https://dashboard.ngrok.com/get-started/your-authtoken):
   `ngrok config add-authtoken TU_TOKEN`
3. (Recomendado) Abre `start-ngrok.bat` y cambia `AUTH_USER` y `AUTH_PASS`.

## Cada vez que quieras publicarla
- Windows: doble clic en `start-ngrok.bat`
- Mac/Linux: `bash start-ngrok.sh`

En la ventana de ngrok verás una línea `Forwarding https://xxxx.ngrok-free.app -> http://localhost:3000`.
Esa URL es tu página web. Al abrirla, ngrok (plan gratis) muestra un aviso: pulsa "Visit Site".
Luego el navegador pedirá el usuario y contraseña que configuraste.

## Dominio fijo (gratis)
Con la URL aleatoria cambia en cada arranque. En el dashboard de ngrok (Domains) puedes reclamar un dominio gratis y usarlo:
`ngrok http --url=tu-dominio.ngrok-free.app 3000`

## Notas
- La página solo está disponible mientras tu PC y el script estén encendidos.
- Los datos viven en `db/checkpoints.db` de tu PC.
- Sin AUTH_USER/AUTH_PASS cualquiera con el enlace puede crear y borrar QR.
