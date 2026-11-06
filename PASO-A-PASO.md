# Publicar QR Checkpoints GRATIS (Render + Turso)

Necesitas 3 cuentas gratuitas: **GitHub** (guarda el código), **Turso** (guarda los QR) y **Render** (corre la página).
Tiempo estimado: 20-30 minutos.

---

## PARTE 1 · Turso (la base de datos)

1. Entra a https://turso.tech y regístrate (puedes usar tu cuenta de GitHub o Google).
2. En el panel crea una base de datos nueva (**Create Database**), nómbrala `qr-checkpoints` y elige la región más cercana.
3. Abre la base de datos y copia dos datos:
   - **URL**: empieza con `libsql://qr-checkpoints-tuusuario.turso.io`
   - **Token**: usa el botón *Generate Token* (o *Create Token*) y copia el texto largo. Guárdalo, solo se muestra una vez.

> Guarda URL y token en un bloc de notas; los usarás en la Parte 2 y en la Parte 4.

---

## PARTE 2 · Pasar tus QR actuales a Turso (opcional)

Solo si quieres conservar los QR que ya tienes. Si prefieres empezar de cero, salta a la Parte 3.

1. Descomprime este proyecto en una carpeta nueva.
2. Copia **tu carpeta `db` original** (la que tiene `checkpoints.db`) dentro de esta carpeta nueva.
3. Abre una terminal (cmd) en la carpeta y ejecuta, cambiando tus valores:

   **Windows (cmd):**
   ```
   npm install
   set TURSO_DATABASE_URL=libsql://qr-checkpoints-tuusuario.turso.io
   set TURSO_AUTH_TOKEN=tu_token_largo
   node scripts/importar-a-turso.js
   ```
   **Mac/Linux:**
   ```
   npm install
   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/importar-a-turso.js
   ```
4. Debe decir: `Listo: N checkpoint(s) importados`.

---

## PARTE 3 · GitHub (subir el código)

1. Entra a https://github.com y crea una cuenta si no tienes.
2. Botón **New repository** → nombre `qr-checkpoints` → marca **Private** → *Create repository*.
3. En la página del repo pulsa **uploading an existing file** y arrastra el CONTENIDO de la carpeta del proyecto:
   `server.js`, `package.json`, `package-lock.json`, `render.yaml`, la carpeta `public`, la carpeta `scripts`, etc.
   - **NO subas** `node_modules` ni la carpeta `db` (es tu base de datos local).
4. Pulsa **Commit changes**.

---

## PARTE 4 · Render (publicar la página)

1. Entra a https://render.com y regístrate con tu cuenta de GitHub (autoriza el acceso a tu repo).
2. **New +** → **Web Service** → elige tu repo `qr-checkpoints`.
3. Configura:
   - **Language/Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
4. En **Environment Variables** agrega estas 4:

   | Nombre | Valor |
   |---|---|
   | `TURSO_DATABASE_URL` | la URL de Turso |
   | `TURSO_AUTH_TOKEN` | el token de Turso |
   | `AUTH_USER` | el usuario que quieras para entrar |
   | `AUTH_PASS` | una contraseña larga |
   | `NODE_VERSION` | `20` |

5. Pulsa **Create Web Service**. Espera 2-4 minutos a que diga **Live**.
6. Tu página queda en una URL tipo `https://qr-checkpoints-xxxx.onrender.com`. Ábrela, escribe usuario y contraseña y listo.

---

## Cosas que debes saber

- Tras 15 min sin visitas el servicio se duerme; la primera visita tarda 30-50 s en despertar. Los datos NO se pierden (están en Turso).
- Para actualizar la página: cambia el archivo en GitHub y Render redespliega solo.
- Sin `AUTH_USER`/`AUTH_PASS` cualquiera con el enlace podría crear y borrar QR. No los omitas.
- Para probar en tu PC sin Turso: `npm install` y `node server.js` (usa el archivo `db/checkpoints.db`).
