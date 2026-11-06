import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createClient } from '@libsql/client';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_USER = process.env.AUTH_USER || '';
const AUTH_PASS = process.env.AUTH_PASS || '';

// Middleware
app.set('trust proxy', true); // detrás de ngrok
app.use(cors());

// Protección opcional con usuario/contraseña (recomendado al exponer con ngrok).
// Se activa definiendo AUTH_USER y AUTH_PASS como variables de entorno.
if (AUTH_USER && AUTH_PASS) {
  app.use((req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const decoded = Buffer.from(encoded, 'base64').toString();
      const i = decoded.indexOf(':');
      if (decoded.slice(0, i) === AUTH_USER && decoded.slice(i + 1) === AUTH_PASS) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="QR Checkpoints"');
    res.status(401).send('Autenticación requerida');
  });
}

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos (libSQL = SQLite). En la nube usa Turso; en local, un archivo.
const dbPath = path.join(__dirname, 'db', 'checkpoints.db');
const useRemote = !!process.env.TURSO_DATABASE_URL;
let db = null;

async function initDatabase() {
  if (useRemote) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });
  } else {
    mkdirSync(path.join(__dirname, 'db'), { recursive: true });
    db = createClient({ url: 'file:' + dbPath });
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Inserta un checkpoint; el código CP-001, CP-002... se deriva del id
// (así no depende de ningún contador en memoria y sobrevive a reinicios).
async function insertCheckpoint(name, url) {
  const tmp = 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  const ins = await db.execute({
    sql: 'INSERT INTO checkpoints (name, url, code) VALUES (?, ?, ?)',
    args: [name, url, tmp]
  });
  const id = Number(ins.lastInsertRowid);
  const code = 'CP-' + String(id).padStart(3, '0');
  await db.execute({ sql: 'UPDATE checkpoints SET code = ? WHERE id = ?', args: [code, id] });
  const row = (await db.execute({
    sql: 'SELECT id, name, url, code, created_at FROM checkpoints WHERE id = ?',
    args: [id]
  })).rows[0];
  return { id: Number(row.id), name: row.name, url: row.url, code: row.code, created_at: row.created_at };
}

async function getCheckpoint(id) {
  const r = await db.execute({
    sql: 'SELECT id, name, url, code FROM checkpoints WHERE id = ?',
    args: [parseInt(id)]
  });
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return { id: Number(row.id), name: row.name, url: row.url, code: row.code };
}

// API: Obtener todos los checkpoints
app.get('/api/checkpoints', async (req, res) => {
  try {
    const r = await db.execute('SELECT id, name, url, code, created_at FROM checkpoints ORDER BY id DESC');
    res.json(r.rows.map(row => ({
      id: Number(row.id), name: row.name, url: row.url, code: row.code, created_at: row.created_at
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Agregar nuevo checkpoint
app.post('/api/checkpoints', async (req, res) => {
  try {
    let { name, url } = req.body;

    if (!url || !url.trim()) {
      return res.status(400).json({ error: 'La URL no puede estar vacía' });
    }

    url = url.trim();
    if (!/^[a-zA-Z]+:\/\//.test(url)) {
      url = 'https://' + url;
    }
    name = (name || '').trim() || 'Checkpoint';

    res.json(await insertCheckpoint(name, url));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Agregar múltiples checkpoints
app.post('/api/checkpoints/bulk', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Se espera un array de items' });
    }

    const added = [];
    for (const line of items) {
      const trimmed = String(line).trim();
      if (!trimmed) continue;

      let name = '', url = trimmed;
      const idx = trimmed.indexOf(',');
      if (idx > -1) {
        name = trimmed.slice(0, idx).trim();
        url = trimmed.slice(idx + 1).trim();
      }
      if (!url) continue;
      if (!/^[a-zA-Z]+:\/\//.test(url)) url = 'https://' + url;

      added.push(await insertCheckpoint(name || 'Checkpoint', url));
    }
    res.json({ added: added.length, items: added });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Eliminar checkpoint
app.delete('/api/checkpoints/:id', async (req, res) => {
  try {
    await db.execute({ sql: 'DELETE FROM checkpoints WHERE id = ?', args: [parseInt(req.params.id)] });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: Generar y descargar QR como PNG
app.get('/api/qr/:id', async (req, res) => {
  try {
    const checkpoint = await getCheckpoint(req.params.id);
    if (!checkpoint) {
      return res.status(404).json({ error: 'Checkpoint no encontrado' });
    }

    const qrDataUrl = await QRCode.toDataURL(checkpoint.url, {
      width: 200,
      margin: 1,
      color: {
        dark: '#20262E',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    });

    res.json({ qr: qrDataUrl });
  } catch (err) {
    console.error('Error en /api/qr/:id -', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Descargar QR como PNG (binary)
app.get('/api/qr/:id/download', async (req, res) => {
  try {
    const checkpoint = await getCheckpoint(req.params.id);
    if (!checkpoint) {
      return res.status(404).json({ error: 'Checkpoint no encontrado' });
    }

    // Generar QR con tamaño más grande y margen amplio
    const pngBuffer = await QRCode.toBuffer(checkpoint.url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#20262E',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    });

    // Descargar con nombre descriptivo
    const filename = sanitizeFilename(checkpoint.code + '_' + checkpoint.name);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.png"`);
    res.send(pngBuffer);
  } catch (err) {
    console.error('Error en /api/qr/:id/download -', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Descargar QR con nombre en PDF
app.get('/api/qr/:id/download-pdf', async (req, res) => {
  try {
    const checkpoint = await getCheckpoint(req.params.id);
    if (!checkpoint) {
      return res.status(404).json({ error: 'Checkpoint no encontrado' });
    }

    // Generar QR como buffer (no data URL)
    const qrBuffer = await QRCode.toBuffer(checkpoint.url, {
      width: 250,
      margin: 2,
      color: {
        dark: '#20262E',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H'
    });

    // Crear PDF
    const doc = new PDFDocument({
      size: 'letter',
      margin: 40
    });

    const filename = sanitizeFilename(checkpoint.code + '_' + checkpoint.name);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);

    doc.pipe(res);

    // Título
    doc.fontSize(16).font('Helvetica-Bold').text('Punto de Control', { align: 'center' });
    doc.moveDown(0.5);

    // Código
    doc.fontSize(12).font('Helvetica').text(`Código: ${checkpoint.code}`, { align: 'center' });
    doc.moveDown(0.5);

    // Nombre/Etiqueta
    doc.fontSize(14).font('Helvetica-Bold').text(checkpoint.name, { align: 'center', width: 540 });
    doc.moveDown(1);

    // QR - calcular posición para centrar
    const pageWidth = doc.page.width;
    const qrSize = 250;
    const qrX = (pageWidth - qrSize) / 2;
    
    doc.image(qrBuffer, qrX, doc.y, {
      width: qrSize,
      height: qrSize
    });
    doc.moveDown(8);

    // URL
    doc.fontSize(10).font('Helvetica').text('URL: ' + checkpoint.url, { 
      align: 'center',
      width: 550,
      ellipsis: true
    });

    doc.end();
  } catch (err) {
    console.error('Error en /api/qr/:id/download-pdf -', err);
    res.status(500).json({ error: err.message });
  }
});

// Función auxiliar para limpiar nombres de archivo
function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9_\-]+/gi, '_').replace(/_+/g, '_').slice(0, 60);
}

// Iniciar servidor
async function startServer() {
  await initDatabase();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  🎯 GENERADOR DE QR - CHECKPOINTS     ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
    console.log(useRemote ? '✓ Base de datos: Turso (remota)' : `✓ Base de datos: ${dbPath}`);
    console.log(AUTH_USER && AUTH_PASS ? '🔒 Contraseña activada' : '⚠️  Sin contraseña (define AUTH_USER y AUTH_PASS antes de exponer con ngrok)');
    console.log(`\n📱 Abre tu navegador en http://localhost:${PORT}\n`);
  });
}

startServer().catch(err => {
  console.error('Error al inicializar:', err);
  process.exit(1);
});
