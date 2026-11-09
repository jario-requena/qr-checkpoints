# Publicar QR Checkpoints GRATIS (Render + Turso) — con usuarios

Necesitas 3 cuentas gratuitas: **GitHub** (guarda el código), **Turso** (guarda los datos) y **Render** (corre la página).

## Cómo funcionan los usuarios
- Solo el **administrador** (tú) crea cuentas, desde la página **Administrar usuarios**. No hay registro público.
- Cada usuario ve, descarga y borra **solo sus propios QR**.
- Los QR en sí **no piden login** al escanearlos: contienen directamente el enlace de destino.
- `AUTH_USER` y `AUTH_PASS` son tu cuenta de **administrador inicial** (se crea una sola vez, la primera vez que arranca).
  Después puedes cambiar la contraseña desde la página ("Cambiar contraseña").

---

## PARTE 1 · Turso (la base de datos)

1. Entra a https://turso.tech y regístrate.
2. Crea una base de datos `qr-checkpoints`.
3. Copia dos datos:
   - **URL**: empieza con `libsql://qr-checkpoints-tuusuario.turso.io`
   - **Token**: botón *Generate Token*. Solo se muestra una vez.

## PARTE 2 · Pasar tus QR actuales (opcional)

Tus QR actuales pasarán a la cuenta de **administrador**.

1. Pon tu carpeta `db` original (con `checkpoints.db`) dentro de la carpeta del proyecto.
2. En la terminal, dentro de la carpeta (Windows cmd):
   ```
   npm install
   set TURSO_DATABASE_URL=libsql://qr-checkpoints-tuusuario.turso.io
   set TURSO_AUTH_TOKEN=tu_token_largo
   set AUTH_USER=tu_usuario_admin
   set AUTH_PASS=tu_contraseña_admin
   node scripts/importar-a-turso.js
   ```
   (En PowerShell: `$env:TURSO_DATABASE_URL="..."` y así con cada variable.)
3. Debe decir: `Listo: N checkpoint(s) importados`.

> Usa en `AUTH_USER` / `AUTH_PASS` el mismo usuario y contraseña que pondrás en Render.

## PARTE 3 · GitHub

```
git add .
git commit -m "Usuarios y login"
git push
```
(La primera vez: `git init`, `git remote add origin ...`, `git push -u origin main`.)
No subas `node_modules` ni la carpeta `db` (el `.gitignore` ya los excluye).

## PARTE 4 · Render

1. Render → **New +** → **Web Service** → tu repo.
2. Language: Node · Build: `npm install` · Start: `npm start` (o `npm run start`) · Instance: **Free**.
3. **Environment Variables**:

   | Nombre | Valor |
   |---|---|
   | `TURSO_DATABASE_URL` | la URL de Turso |
   | `TURSO_AUTH_TOKEN` | el token de Turso |
   | `AUTH_USER` | tu usuario de administrador (ej: `jario`) |
   | `AUTH_PASS` | tu contraseña de administrador (mín. 8 caracteres) |
   | `NODE_VERSION` | `20` |

4. **Create Web Service** y espera a que diga **Live**.
5. Abre la URL `https://....onrender.com` → inicia sesión con tu usuario administrador.

## PARTE 5 · Crear cuentas para otras personas

1. Dentro de la página, arriba a la derecha: **Administrar usuarios**.
2. Escribe un usuario, pulsa **Generar** (crea una contraseña) y **Crear**.
3. Copia usuario y contraseña y envíaselos a la persona. Ella puede cambiar su contraseña desde su sesión.
4. Desde el mismo panel puedes **cambiar la contraseña** de alguien (cierra sus sesiones) o **eliminar** su cuenta (borra también sus QR).

---

## Cosas que debes saber
- Tras 15 min sin visitas el servicio gratis se duerme; la primera visita tarda 30-50 s. Los datos no se pierden.
- Tras 5 intentos fallidos de login se bloquea 15 minutos (protección contra adivinar contraseñas).
- Si **olvidas la contraseña de administrador**: en Render agrega `RESET_ADMIN` = `1` y pon la nueva contraseña en `AUTH_PASS`; al redeplegar se restablece. Luego **borra** `RESET_ADMIN`.
- `AUTH_USER` / `AUTH_PASS` solo se usan si todavía no existe administrador. Para cambiar la clave después, usa "Cambiar contraseña" en la página.
- Solo se aceptan enlaces `http://` o `https://`.
- Para probar en tu PC: `start.bat` (usa el archivo `db/checkpoints.db`).
