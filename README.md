# 🎯 Generador de QR - Puntos de Control

Generador de códigos QR permanentes (sin vencimiento, sin publicidad) con **cuentas de usuario**:
el administrador crea las cuentas y cada usuario gestiona solo sus propios QR.

- Backend: Node.js + Express · Base de datos: SQLite (libSQL; Turso en la nube, archivo en local)
- Correos: API HTTP de [Resend](https://resend.com) (Render free bloquea SMTP)
- Publicar gratis: ver **PASO-A-PASO.md** (Render + Turso)
- Publicar desde tu PC con túnel: ver **NGROK.md**

## Uso local
1. `start.bat` (Windows) o `bash start.sh` (Mac/Linux). La primera vez crea el administrador con `AUTH_USER` / `AUTH_PASS`
   (por defecto `admin` / `cambia-esta-clave`; cámbialos en el script antes del primer arranque).
2. Abre http://localhost:3000: sin sesión verás la landing; inicia sesión desde ahí.
3. Menú superior: **Administrar usuarios** (solo admin), **Cambiar contraseña**, **Cerrar sesión**.

Sin `RESEND_API_KEY` los correos no se envían: se imprimen en la consola del servidor (útil para probar el código de recuperación).

## Funciones
- Landing pública en `/` con acceso, solicitud de cuenta y recuperación de contraseña
- Agregar un punto o varios a la vez (una línea por punto: `Etiqueta, https://enlace`)
- Descargar PNG, PDF individual o todo en .zip
- **Unificar** 2 o más QR en un solo PDF (hoja carta, 12 por página) o PNG, con la etiqueta encima de cada QR.
  Se seleccionan en la lista o se marca "Unificar los nuevos QR" al agregar varios a la vez
- Numeración propia por usuario (CP-001, CP-002…)
- **Recuperar contraseña** (`/recuperar.html`): código de 6 dígitos por correo, válido 15 minutos y 5 intentos
- **Solicitar cuenta** (`/solicitar.html`): avisa por correo al admin y aparece en el panel de administración
- El admin registra el correo de cada usuario; al cambiarle la contraseña se le envía por correo

## Variables de entorno
| Variable | Uso |
|---|---|
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Base de datos en la nube |
| `AUTH_USER`, `AUTH_PASS` | Administrador inicial |
| `RESEND_API_KEY` | Clave de la API de Resend |
| `MAIL_FROM` | Remitente, ej. `MisQR <no-reply@misqr.online>` |
| `ADMIN_EMAIL` | Correo que recibe los avisos de solicitudes (si falta, se usa el correo del admin en la BD) |
| `APP_URL` | URL pública para los enlaces de los correos, ej. `https://misqr.online` |

## Configurar Resend con misqr.online (Hostinger)
1. Crea una cuenta en resend.com → **Domains** → **Add domain** → `misqr.online`.
2. Resend muestra varios registros DNS (MX y TXT de SPF en `send.misqr.online`, TXT de DKIM `resend._domainkey`).
   Cópialos en Hostinger → **Dominios → misqr.online → DNS / Nameservers → Administrar registros DNS**.
3. Pulsa **Verify** en Resend (puede tardar de minutos a unas horas).
4. Crea una API key (**API Keys → Create**, permiso "Sending access") y ponla en Render como `RESEND_API_KEY`,
   junto con `ADMIN_EMAIL`, `MAIL_FROM` y `APP_URL`.
5. Tras desplegar, entra a **Administrar usuarios → Editar correo** y asigna el correo a los usuarios existentes
   (incluido el tuyo) para que puedan recuperar su contraseña.
