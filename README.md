# 🎯 Generador de QR - Puntos de Control

Aplicación de escritorio para generar códigos QR permanentes (sin vencimiento) a partir de enlaces de checkpoints. Los datos se almacenan en una base de datos SQLite local.

## ✨ Características

- ✅ **QR Permanentes**: Nunca vencen, no dependen de terceros
- ✅ **Sin Publicidad**: Código generado 100% local
- ✅ **Base de Datos**: Todos los QR guardados en SQLite
- ✅ **Descarga Individual**: PNG de cada QR
- ✅ **Descarga por Lotes**: Todos los QR en un ZIP
- ✅ **Interfaz Intuitiva**: Agregar, eliminar, buscar checkpoints

---

## 🎯 ¿Cómo quieres ejecutarla?

### Opción 1: Node.js (desarrollo, terminal visible)
- Necesitas Node.js instalado
- La terminal queda visible
- Rápido de configurar

### Opción 2: Ejecutable .exe (recomendado, sin terminal)
- NO necesitas Node.js instalado
- Se ejecuta con doble clic
- Sin terminal visible
- Ideal para usar a diario

**[→ Ve a COMPILAR-EXE.md para crear el .exe](COMPILAR-EXE.md)**

---

## 🚀 Instalación (Primera Vez)

### Requisitos previos
- **Node.js v20+** (ya lo tienes: v24.14.0 ✓)
- **Cualquier navegador moderno**

### Pasos

1. **Descarga la carpeta completa** `qr-checkpoints/` en tu portátil

2. **Abre una terminal/cmd** dentro de la carpeta `qr-checkpoints/`

3. **Ejecuta el script de inicio**:
   
   **En Windows:**
   ```
   start.bat
   ```
   
   **En Mac/Linux:**
   ```
   bash start.sh
   ```

4. **Espera a que aparezca**:
   ```
   ✓ Servidor corriendo en http://localhost:3000
   ```

5. **Abre tu navegador** en: `http://localhost:3000`

---

## 📖 Cómo Usar

### Agregar un Checkpoint
1. Escribe la **etiqueta** (opcional) - ej: "Entrada Principal"
2. Pega el **enlace** - ej: `https://tuempresa.com/checkpoint/entrada`
3. Haz clic en **"Agregar punto"**
4. El QR aparece al instante y se guarda en la BD

### Agregar Varios Checkpoints
1. Haz clic en **"+ Agregar varios checkpoints a la vez"**
2. Pega una lista (uno por línea):
   ```
   Entrada, https://empresa.com/cp1
   https://empresa.com/cp2
   Salida, https://empresa.com/cp3
   ```
3. Haz clic en **"Agregar lista"**

### Descargar
- **Individual**: Botón PNG en cada tarjeta
- **Todos juntos**: Botón "Descargar todo (.zip)"

### Eliminar
- Cada tarjeta tiene botón **"Eliminar"**
- O vacía todo con **"Vaciar lista"**

---

## 💾 Datos Guardados

- **Ubicación**: `db/checkpoints.db`
- **Tipo**: Base de datos SQLite (archivo local)
- **Persistencia**: Los datos permanecen incluso si cierras la aplicación

---

## ⚙️ Arranque Futuro

**Después de la instalación inicial**, simplemente ejecuta el script:

- **Windows**: Doble clic en `start.bat`
- **Mac/Linux**: `bash start.sh` (o doble clic si está configurado)

---

## 🔧 Solución de Problemas

### El navegador no abre automáticamente
- Ve manualmente a `http://localhost:3000`

### Puerto 3000 está en uso
- Edita `server.js` línea 28: cambia `const PORT = 3000` a otro puerto (ej: 3001)

### Error: "cannot find module"
- Abre terminal en la carpeta `qr-checkpoints/`
- Ejecuta: `npm install`

### Los QR no se generan
- Verifica que el servidor esté corriendo (debe decir ✓ en la terminal)
- Abre la consola del navegador (F12) para ver errores

---

## 📱 ¿Se sincronizan mis QR en otros dispositivos?

No (por ahora). La base de datos vive solo en tu portátil. Si necesitas:
- **Usar desde otro PC**: Copia la carpeta `qr-checkpoints/` a esa máquina
- **Acceder desde teléfono**: Comparte el archivo `db/checkpoints.db` o configura cloud sync

---

## 🛑 Detener la Aplicación

Presiona **Ctrl+C** en la terminal/cmd donde está corriendo el servidor.

---

## 📄 Información Técnica

- **Backend**: Node.js + Express
- **Base de Datos**: SQLite (better-sqlite3)
- **Generador QR**: qrcode library
- **Frontend**: HTML + Vanilla JS

---

¿Preguntas? Revisa los mensajes de error en la terminal o en la consola del navegador (F12).
