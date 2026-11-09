# 🎯 Generador de QR - Puntos de Control

Generador de códigos QR permanentes (sin vencimiento, sin publicidad) con **cuentas de usuario**:
el administrador crea las cuentas y cada usuario gestiona solo sus propios QR.

- Backend: Node.js + Express · Base de datos: SQLite (libSQL; Turso en la nube, archivo en local)
- Publicar gratis: ver **PASO-A-PASO.md** (Render + Turso)
- Publicar desde tu PC con túnel: ver **NGROK.md**

## Uso local
1. `start.bat` (Windows) o `bash start.sh` (Mac/Linux). La primera vez crea el administrador con `AUTH_USER` / `AUTH_PASS`
   (por defecto `admin` / `cambia-esta-clave`; cámbialos en el script antes del primer arranque).
2. Abre http://localhost:3000 e inicia sesión.
3. Menú superior: **Administrar usuarios** (solo admin), **Cambiar contraseña**, **Cerrar sesión**.

## Funciones
- Agregar un punto o varios a la vez (una línea por punto: `Etiqueta, https://enlace`)
- Descargar PNG, PDF individual o todo en .zip
- Numeración propia por usuario (CP-001, CP-002…)
