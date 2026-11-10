import express from 'express';
import bodyParser from 'body-parser';
import { createClient } from '@libsql/client';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { initDb, hashPassword, verifyPassword } from './db.js';
import { sendMail, layout, escapeHtml, EMAIL_RE, APP_URL, ADMIN_EMAIL } from './mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const app = express();
const PORT = process.env.PORT || 3000;

const SESSION_DAYS = 30;
const COOKIE = 'sid';

// ---------- Base de datos (libSQL = SQLite; Turso en la nube, archivo en local) ----------
const dbPath = path.join(__dirname, 'db', 'checkpoints.db');
const useRemote = !!process.env.TURSO_DATABASE_URL;
let db = null;

// ---------- Utilidades ----------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9_\-]+/gi, '_').replace(/_+/g, '_').slice(0, 60);
}

function normalizeUrl(raw) {
  let url = String(raw || '').trim();
  if (!url) return { error: 'La URL no puede estar vacía' };
  if (url.length > 2000) return { error: 'La URL es demasiado larga' };
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) url = 'https://' + url;
  if (!/^https?:\/\//i.test(url)) return { error: 'Solo se permiten enlaces http:// o https://' };
  return { url };
}

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,32}$/;
const checkPassword = (p) =>
  typeof p === 'string' && p.length >= 8 && p.length <= 200 ? null : 'La contraseña debe tener entre 8 y 200 caracteres';

// ---------- Límite de intentos de login ----------
const failures = new Map(); // clave -> { count, until }
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

function isLocked(key) {
  const f = failures.get(key);
  return f && f.until > Date.now();
}
function registerFail(key) {
  const f = failures.get(key);
  const now = Date.now();
  if (!f || (f.until && f.until <= now)) {
    failures.set(key, { count: 1, until: 0, first: now });
    return;
  }
  f.count++;
  if (f.count >= MAX_FAILS) f.until = now + LOCK_MS;
}
// Límite simple de peticiones por ventana (correos de recuperación, solicitudes)
const hits = new Map(); // clave -> { count, start }
function overLimit(key, max, windowMs) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.start > windowMs) {
    hits.set(key, { count: 1, start: now });
    return false;
  }
  return ++h.count > max;
}
const HOUR = 3600 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [k, f] of failures) if ((f.until && f.until < now) || now - f.first > LOCK_MS) failures.delete(k);
  for (const [k, h] of hits) if (now - h.start > HOUR) hits.delete(k);
}, 5 * 60 * 1000).unref();

// ---------- Middleware ----------
app.set('trust proxy', true); // detrás de Render / ngrok
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin'
  });
  next();
});
app.use(bodyParser.json({ limit: '200kb' }));

// Identifica al usuario a partir de la cookie de sesión
app.use(wrap(async (req, res, next) => {
  const token = parseCookies(req)[COOKIE];
  req.user = null;
  if (token) {
    const r = await db.execute({
      sql: `SELECT u.id, u.username, u.is_admin
            FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?`,
      args: [sha256(token), Date.now()]
    });
    if (r.rows.length) {
      const u = r.rows[0];
      req.user = { id: Number(u.id), username: u.username, isAdmin: Number(u.is_admin) === 1 };
      req.sessionHash = sha256(token);
    }
  }
  next();
}));

const requireAuth = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: 'Sesión no iniciada' });
const requireAdmin = (req, res, next) =>
  req.user && req.user.isAdmin ? next() : res.status(403).json({ error: 'Solo el administrador' });

// ---------- Páginas ----------
app.get(['/', '/index.html'], (req, res) =>
  res.sendFile(path.join(PUBLIC, req.user ? 'index.html' : 'landing.html')));
app.get('/admin.html', (req, res) =>
  req.user && req.user.isAdmin ? res.sendFile(path.join(PUBLIC, 'admin.html')) : res.redirect('/'));
app.use(express.static(PUBLIC, { index: false }));

// ---------- Autenticación ----------
async function startSession(req, res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const maxAge = SESSION_DAYS * 24 * 3600 * 1000;
  await db.execute({
    sql: 'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    args: [sha256(token), userId, Date.now() + maxAge]
  });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge, path: '/' });
}

// Hash de relleno para que el tiempo de respuesta no delate si el usuario existe
const DUMMY_HASH = await hashPassword('relleno-no-valido');

app.post('/api/login', wrap(async (req, res) => {
  const username = String((req.body && req.body.username) || '').trim();
  const password = String((req.body && req.body.password) || '');
  const keyIp = 'ip:' + req.ip;
  const keyUser = 'u:' + username.toLowerCase();

  if (isLocked(keyIp) || isLocked(keyUser)) {
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.' });
  }

  const r = await db.execute({
    sql: 'SELECT id, password_hash FROM users WHERE username = ?',
    args: [username]
  });
  const row = r.rows[0];
  const ok = await verifyPassword(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok) {
    registerFail(keyIp);
    registerFail(keyUser);
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  failures.delete(keyIp);
  failures.delete(keyUser);
  await startSession(req, res, Number(row.id));
  res.json({ ok: true });
}));

// ---------- Recuperación de contraseña (código de 6 dígitos por correo) ----------
const RESET_MS = 15 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;

async function findUserByIdentifier(identifier) {
  const id = String(identifier || '').trim();
  if (!id) return null;
  const r = id.includes('@')
    ? await db.execute({ sql: 'SELECT id, username, email FROM users WHERE lower(email) = lower(?)', args: [id] })
    : await db.execute({ sql: 'SELECT id, username, email FROM users WHERE username = ?', args: [id] });
  const u = r.rows[0];
  return u ? { id: Number(u.id), username: u.username, email: u.email } : null;
}

app.post('/api/password/forgot', wrap(async (req, res) => {
  const identifier = String((req.body && req.body.identifier) || '').trim().slice(0, 200);
  if (!identifier) return res.status(400).json({ error: 'Escribe tu usuario o correo' });
  if (overLimit('forgot-ip:' + req.ip, 10, HOUR) || overLimit('forgot-id:' + identifier.toLowerCase(), 3, RESET_MS)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.' });
  }
  const user = await findUserByIdentifier(identifier);
  if (user && user.email) {
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    await db.execute({
      sql: `INSERT INTO password_resets (user_id, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)
            ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`,
      args: [user.id, sha256(code), Date.now() + RESET_MS]
    });
    await sendMail({
      to: user.email,
      subject: `Tu código de recuperación: ${code}`,
      text: `Hola ${user.username}, tu código para restablecer la contraseña es ${code}. Vence en 15 minutos. Si no lo pediste, ignora este correo.`,
      html: layout('Recuperar contraseña', `
        <p>Hola <b>${escapeHtml(user.username)}</b>, usa este código para restablecer tu contraseña:</p>
        <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:.3em;color:#871919;background:#fff;border-radius:6px;padding:14px;text-align:center;">${code}</div>
        <p style="font-size:13px;color:#605e5a;">Vence en 15 minutos. Si no lo pediste, ignora este correo.</p>
        <p><a href="${APP_URL}/recuperar.html" style="color:#871919;">Ir a restablecer contraseña</a></p>`)
    });
  }
  // Respuesta idéntica exista o no la cuenta
  res.json({ ok: true });
}));

app.post('/api/password/reset', wrap(async (req, res) => {
  const { identifier, code, password } = req.body || {};
  const keyIp = 'reset-ip:' + req.ip;
  if (isLocked(keyIp)) {
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.' });
  }
  const err = checkPassword(password);
  if (err) return res.status(400).json({ error: err });

  const invalid = () => {
    registerFail(keyIp);
    return res.status(400).json({ error: 'Código inválido o vencido' });
  };
  const user = await findUserByIdentifier(identifier);
  if (!user || !/^\d{6}$/.test(String(code || '').trim())) return invalid();

  const row = (await db.execute({
    sql: 'SELECT code_hash, expires_at, attempts FROM password_resets WHERE user_id = ?',
    args: [user.id]
  })).rows[0];
  if (!row || Number(row.expires_at) < Date.now()) return invalid();

  const given = Buffer.from(sha256(String(code).trim()), 'hex');
  const expected = Buffer.from(row.code_hash, 'hex');
  if (!crypto.timingSafeEqual(given, expected)) {
    if (Number(row.attempts) + 1 >= RESET_MAX_ATTEMPTS) {
      await db.execute({ sql: 'DELETE FROM password_resets WHERE user_id = ?', args: [user.id] });
    } else {
      await db.execute({ sql: 'UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = ?', args: [user.id] });
    }
    return invalid();
  }

  await db.batch([
    { sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [await hashPassword(password), user.id] },
    { sql: 'DELETE FROM password_resets WHERE user_id = ?', args: [user.id] },
    { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [user.id] }
  ], 'write');
  failures.delete(keyIp);
  failures.delete('u:' + user.username.toLowerCase());
  await startSession(req, res, user.id);
  res.json({ ok: true });
}));

// ---------- Solicitudes de cuenta (públicas) ----------
async function adminNotifyEmail() {
  if (ADMIN_EMAIL) return ADMIN_EMAIL;
  const r = await db.execute('SELECT email FROM users WHERE is_admin = 1 AND email IS NOT NULL ORDER BY id LIMIT 1');
  return r.rows[0] ? r.rows[0].email : '';
}

app.post('/api/account-requests', wrap(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot anti-spam
  const name = String(b.name || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().slice(0, 200);
  const username = String(b.username || '').trim().slice(0, 32);
  const message = String(b.message || '').trim().slice(0, 1000);
  if (!name) return res.status(400).json({ error: 'Escribe tu nombre' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Correo electrónico no válido' });
  if (username && !USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Usuario: 3-32 caracteres (letras, números, punto, guion o guion bajo)' });
  }
  if (overLimit('req-ip:' + req.ip, 3, HOUR)) {
    return res.status(429).json({ error: 'Ya enviaste varias solicitudes. Inténtalo más tarde.' });
  }
  await db.execute({
    sql: 'INSERT INTO account_requests (name, email, username, message) VALUES (?, ?, ?, ?)',
    args: [name, email, username || null, message || null]
  });
  const to = await adminNotifyEmail();
  await sendMail({
    to,
    subject: `Nueva solicitud de cuenta: ${name}`,
    text: `${name} (${email}) solicita una cuenta${username ? ' con el usuario ' + username : ''}.\n${message}\nRevísala en ${APP_URL}/admin.html`,
    html: layout('Nueva solicitud de cuenta', `
      <p><b>Nombre:</b> ${escapeHtml(name)}<br><b>Correo:</b> ${escapeHtml(email)}<br>
      <b>Usuario deseado:</b> ${escapeHtml(username || '—')}</p>
      ${message ? `<p style="background:#fff;border-radius:6px;padding:12px;">${escapeHtml(message)}</p>` : ''}
      <p><a href="${APP_URL}/admin.html" style="color:#871919;font-weight:bold;">Revisar en el panel de administración</a></p>`)
  });
  res.json({ ok: true });
}));

app.use('/api', requireAuth);

app.post('/api/logout', wrap(async (req, res) => {
  await db.execute({ sql: 'DELETE FROM sessions WHERE token_hash = ?', args: [req.sessionHash] });
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
}));

app.get('/api/me', (req, res) => res.json(req.user));

app.post('/api/me/password', wrap(async (req, res) => {
  const { current, password } = req.body || {};
  const err = checkPassword(password);
  if (err) return res.status(400).json({ error: err });
  const r = await db.execute({ sql: 'SELECT password_hash FROM users WHERE id = ?', args: [req.user.id] });
  if (!(await verifyPassword(String(current || ''), r.rows[0].password_hash))) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta' });
  }
  await db.execute({
    sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
    args: [await hashPassword(password), req.user.id]
  });
  // Cierra las demás sesiones de este usuario
  await db.execute({
    sql: 'DELETE FROM sessions WHERE user_id = ? AND token_hash != ?',
    args: [req.user.id, req.sessionHash]
  });
  res.json({ ok: true });
}));

// ---------- Administración de usuarios (solo admin) ----------
app.get('/api/admin/users', requireAdmin, wrap(async (req, res) => {
  const r = await db.execute(`
    SELECT u.id, u.username, u.email, u.is_admin, u.created_at,
           (SELECT COUNT(*) FROM checkpoints c WHERE c.user_id = u.id) AS total
    FROM users u ORDER BY u.id`);
  res.json(r.rows.map(u => ({
    id: Number(u.id), username: u.username, email: u.email || '', isAdmin: Number(u.is_admin) === 1,
    created_at: u.created_at, checkpoints: Number(u.total)
  })));
}));

const isUniqueError = (e) => /UNIQUE/i.test(e.message);
const uniqueMessage = (e) => /email/i.test(e.message) ? 'Ese correo ya está en uso' : 'Ese usuario ya existe';

app.post('/api/admin/users', requireAdmin, wrap(async (req, res) => {
  const username = String((req.body && req.body.username) || '').trim();
  const email = String((req.body && req.body.email) || '').trim();
  const password = req.body && req.body.password;
  const requestId = parseInt(req.body && req.body.requestId) || null;
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Usuario: 3-32 caracteres (letras, números, punto, guion o guion bajo)' });
  }
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Correo electrónico no válido' });
  const err = checkPassword(password);
  if (err) return res.status(400).json({ error: err });
  try {
    const r = await db.execute({
      sql: 'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
      args: [username, await hashPassword(password), email]
    });
    if (requestId) {
      await db.execute({ sql: "UPDATE account_requests SET status = 'approved' WHERE id = ?", args: [requestId] });
    }
    const emailed = await sendMail({
      to: email,
      subject: 'Tu cuenta MisQR está lista',
      text: `Hola ${username}, tu cuenta en MisQR ya está creada.\nLa contraseña es temporal y fue generada por el sistema.\nUsuario: ${username}\nContraseña temporal: ${password}\nInicia sesión en ${APP_URL}/login.html y cámbiala desde "Cambiar contraseña". Si la olvidas, usa "Recuperar contraseña".`,
      html: layout('Tu cuenta está lista', `
        <p>Hola <b>${escapeHtml(username)}</b>, tu cuenta en MisQR ya está creada.</p>
        <p>La contraseña es <b>temporal y fue generada por el sistema</b>.</p>
        <p style="background:#fff;border-radius:6px;padding:12px;font-family:'Courier New',monospace;">
          Usuario: <b>${escapeHtml(username)}</b><br>Contraseña temporal: <b>${escapeHtml(password)}</b></p>
        <p style="font-size:13px;color:#605e5a;">Inicia sesión y cámbiala desde "Cambiar contraseña". Si la olvidas, usa "Recuperar contraseña".</p>
        <p><a href="${APP_URL}/login.html" style="color:#871919;font-weight:bold;">Iniciar sesión</a></p>`)
    });
    res.json({ id: Number(r.lastInsertRowid), username, email, emailed });
  } catch (e) {
    if (isUniqueError(e)) return res.status(409).json({ error: uniqueMessage(e) });
    throw e;
  }
}));

app.post('/api/admin/users/:id/email', requireAdmin, wrap(async (req, res) => {
  const id = parseInt(req.params.id);
  const email = String((req.body && req.body.email) || '').trim();
  if (email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Correo electrónico no válido' });
  try {
    const r = await db.execute({ sql: 'UPDATE users SET email = ? WHERE id = ?', args: [email || null, id] });
    if (!r.rowsAffected) return res.status(404).json({ error: 'Usuario no encontrado' });
  } catch (e) {
    if (isUniqueError(e)) return res.status(409).json({ error: 'Ese correo ya está en uso' });
    throw e;
  }
  res.json({ ok: true, email });
}));

app.post('/api/admin/users/:id/password', requireAdmin, wrap(async (req, res) => {
  const id = parseInt(req.params.id);
  const password = req.body && req.body.password;
  const err = checkPassword(password);
  if (err) return res.status(400).json({ error: err });
  const u = (await db.execute({ sql: 'SELECT username, email FROM users WHERE id = ?', args: [id] })).rows[0];
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  await db.batch([
    { sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [await hashPassword(password), id] },
    { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [id] },
    { sql: 'DELETE FROM password_resets WHERE user_id = ?', args: [id] }
  ], 'write');
  let emailed = false;
  if (u.email) {
    emailed = await sendMail({
      to: u.email,
      subject: 'Tu contraseña de MisQR fue actualizada',
      text: `Hola ${u.username}, el administrador actualizó tu contraseña.\nUsuario: ${u.username}\nNueva contraseña: ${password}\nInicia sesión en ${APP_URL}/login.html y cámbiala si lo deseas.`,
      html: layout('Contraseña actualizada', `
        <p>Hola <b>${escapeHtml(u.username)}</b>, el administrador actualizó tu contraseña.</p>
        <p style="background:#fff;border-radius:6px;padding:12px;font-family:'Courier New',monospace;">
          Usuario: <b>${escapeHtml(u.username)}</b><br>Nueva contraseña: <b>${escapeHtml(password)}</b></p>
        <p style="font-size:13px;color:#605e5a;">Te recomendamos cambiarla después de iniciar sesión.</p>
        <p><a href="${APP_URL}/login.html" style="color:#871919;font-weight:bold;">Iniciar sesión</a></p>`)
    });
  }
  res.json({ ok: true, emailed, email: u.email || '' });
}));

app.get('/api/admin/requests', requireAdmin, wrap(async (req, res) => {
  const r = await db.execute(
    "SELECT id, name, email, username, message, created_at FROM account_requests WHERE status = 'pending' ORDER BY id DESC");
  res.json(r.rows.map(x => ({
    id: Number(x.id), name: x.name, email: x.email, username: x.username || '',
    message: x.message || '', created_at: x.created_at
  })));
}));

app.delete('/api/admin/requests/:id', requireAdmin, wrap(async (req, res) => {
  await db.execute({
    sql: "UPDATE account_requests SET status = 'rejected' WHERE id = ? AND status = 'pending'",
    args: [parseInt(req.params.id)]
  });
  res.json({ ok: true });
}));

app.delete('/api/admin/users/:id', requireAdmin, wrap(async (req, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  const u = (await db.execute({ sql: 'SELECT is_admin FROM users WHERE id = ?', args: [id] })).rows[0];
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (Number(u.is_admin) === 1) return res.status(400).json({ error: 'No se puede eliminar a un administrador' });
  await db.batch([
    { sql: 'DELETE FROM checkpoints WHERE user_id = ?', args: [id] },
    { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [id] },
    { sql: 'DELETE FROM users WHERE id = ?', args: [id] }
  ], 'write');
  res.json({ deleted: true });
}));

// ---------- Checkpoints (siempre filtrados por el usuario de la sesión) ----------
async function insertCheckpoint(userId, name, url) {
  // Contador por usuario, atómico y sin reutilizar números
  const r = await db.execute({
    sql: 'UPDATE users SET next_num = next_num + 1 WHERE id = ? RETURNING next_num - 1 AS num',
    args: [userId]
  });
  if (!r.rows.length) throw new Error('Usuario no encontrado');
  const num = Number(r.rows[0].num);
  const code = 'CP-' + String(num).padStart(3, '0');
  const ins = await db.execute({
    sql: 'INSERT INTO checkpoints (user_id, name, url, num, code) VALUES (?, ?, ?, ?, ?)',
    args: [userId, name, url, num, code]
  });
  const id = Number(ins.lastInsertRowid);
  const row = (await db.execute({
    sql: 'SELECT id, name, url, code, created_at FROM checkpoints WHERE id = ?',
    args: [id]
  })).rows[0];
  return { id: Number(row.id), name: row.name, url: row.url, code: row.code, created_at: row.created_at };
}

async function getCheckpoint(id, userId) {
  const r = await db.execute({
    sql: 'SELECT id, name, url, code FROM checkpoints WHERE id = ? AND user_id = ?',
    args: [parseInt(id), userId]
  });
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return { id: Number(row.id), name: row.name, url: row.url, code: row.code };
}

app.get('/api/checkpoints', wrap(async (req, res) => {
  const r = await db.execute({
    sql: 'SELECT id, name, url, code, created_at FROM checkpoints WHERE user_id = ? ORDER BY id DESC',
    args: [req.user.id]
  });
  res.json(r.rows.map(row => ({
    id: Number(row.id), name: row.name, url: row.url, code: row.code, created_at: row.created_at
  })));
}));

app.post('/api/checkpoints', wrap(async (req, res) => {
  const { url, error } = normalizeUrl(req.body && req.body.url);
  if (error) return res.status(400).json({ error });
  const name = String((req.body && req.body.name) || '').trim().slice(0, 200) || 'Checkpoint';
  res.json(await insertCheckpoint(req.user.id, name, url));
}));

app.post('/api/checkpoints/bulk', wrap(async (req, res) => {
  const items = req.body && req.body.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Se espera un array de items' });
  if (items.length > 500) return res.status(400).json({ error: 'Máximo 500 líneas por vez' });

  const added = [];
  for (const line of items) {
    const trimmed = String(line).trim();
    if (!trimmed) continue;
    let name = '', raw = trimmed;
    const idx = trimmed.indexOf(',');
    if (idx > -1) {
      name = trimmed.slice(0, idx).trim();
      raw = trimmed.slice(idx + 1).trim();
    }
    const { url, error } = normalizeUrl(raw);
    if (error) continue;
    added.push(await insertCheckpoint(req.user.id, name.slice(0, 200) || 'Checkpoint', url));
  }
  res.json({ added: added.length, items: added });
}));

app.delete('/api/checkpoints/:id', wrap(async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM checkpoints WHERE id = ? AND user_id = ?',
    args: [parseInt(req.params.id), req.user.id]
  });
  res.json({ deleted: true });
}));

const QR_COLORS = { dark: '#20262E', light: '#FFFFFF' };

app.get('/api/qr/:id', wrap(async (req, res) => {
  const cp = await getCheckpoint(req.params.id, req.user.id);
  if (!cp) return res.status(404).json({ error: 'Checkpoint no encontrado' });
  const qr = await QRCode.toDataURL(cp.url, { width: 200, margin: 1, color: QR_COLORS, errorCorrectionLevel: 'H' });
  res.json({ qr });
}));

app.get('/api/qr/:id/download', wrap(async (req, res) => {
  const cp = await getCheckpoint(req.params.id, req.user.id);
  if (!cp) return res.status(404).json({ error: 'Checkpoint no encontrado' });
  const png = await QRCode.toBuffer(cp.url, { width: 300, margin: 2, color: QR_COLORS, errorCorrectionLevel: 'H' });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(cp.code + '_' + cp.name)}.png"`);
  res.send(png);
}));

app.get('/api/qr/:id/download-pdf', wrap(async (req, res) => {
  const cp = await getCheckpoint(req.params.id, req.user.id);
  if (!cp) return res.status(404).json({ error: 'Checkpoint no encontrado' });
  const qrBuffer = await QRCode.toBuffer(cp.url, { width: 250, margin: 2, color: QR_COLORS, errorCorrectionLevel: 'H' });

  const doc = new PDFDocument({ size: 'letter', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(cp.code + '_' + cp.name)}.pdf"`);
  doc.pipe(res);

  doc.fontSize(16).font('Helvetica-Bold').text('Punto de Control', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(12).font('Helvetica').text(`Código: ${cp.code}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica-Bold').text(cp.name, { align: 'center', width: 540 });
  doc.moveDown(1);

  const qrSize = 250;
  const qrX = (doc.page.width - qrSize) / 2;
  doc.image(qrBuffer, qrX, doc.y, { width: qrSize, height: qrSize });
  doc.moveDown(8);
  doc.fontSize(10).font('Helvetica').text('URL: ' + cp.url, { align: 'center', width: 550, ellipsis: true });
  doc.end();
}));

const MERGE_MAX = 100;

app.post('/api/qr/merge', wrap(async (req, res) => {
  const raw = req.body && req.body.ids;
  if (!Array.isArray(raw)) return res.status(400).json({ error: 'Se espera un array de ids' });
  const ids = [...new Set(raw.map(n => parseInt(n)).filter(Number.isInteger))];
  if (ids.length < 2) return res.status(400).json({ error: 'Selecciona al menos 2 QR' });
  if (ids.length > MERGE_MAX) return res.status(400).json({ error: `Máximo ${MERGE_MAX} QR por archivo` });

  const r = await db.execute({
    sql: `SELECT id, name, url, code FROM checkpoints WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
    args: [req.user.id, ...ids]
  });
  const byId = new Map(r.rows.map(row => [Number(row.id), row]));
  const cps = ids.map(id => byId.get(id)).filter(Boolean);
  if (cps.length < 2) return res.status(404).json({ error: 'No se encontraron los QR seleccionados' });

  const doc = new PDFDocument({ size: 'letter', margin: 36, autoFirstPage: false });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="qr-unificados.pdf"');
  doc.pipe(res);

  const COLS = 3, ROWS = 4, M = 36, LABEL_H = 34;
  const pageW = 612, pageH = 792;
  const cellW = (pageW - 2 * M) / COLS;
  const cellH = (pageH - 2 * M) / ROWS;
  const qrSize = Math.min(cellW - 24, cellH - LABEL_H - 16);

  for (let i = 0; i < cps.length; i++) {
    const slot = i % (COLS * ROWS);
    if (slot === 0) doc.addPage();
    const cp = cps[i];
    const x = M + (slot % COLS) * cellW;
    const y = M + Math.floor(slot / COLS) * cellH;

    doc.save().lineWidth(0.5).dash(3, { space: 3 }).strokeColor('#D8CFB8')
      .rect(x + 2, y + 2, cellW - 4, cellH - 4).stroke().restore();

    doc.fillColor('#B23A2E').font('Helvetica-Bold').fontSize(9)
      .text(cp.code, x + 8, y + 8, { width: cellW - 16, align: 'center', lineBreak: false });
    doc.fillColor('#20262E').font('Helvetica-Bold').fontSize(10)
      .text(cp.name, x + 8, y + 20, { width: cellW - 16, align: 'center', height: 13, ellipsis: true, lineBreak: false });

    const png = await QRCode.toBuffer(cp.url, { width: 400, margin: 1, color: QR_COLORS, errorCorrectionLevel: 'H' });
    doc.image(png, x + (cellW - qrSize) / 2, y + LABEL_H + 6, { width: qrSize, height: qrSize });
  }
  doc.end();
}));

// ---------- Errores ----------
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Error del servidor' });
});

// ---------- Arranque ----------
async function startServer() {
  if (useRemote) {
    db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  } else {
    mkdirSync(path.join(__dirname, 'db'), { recursive: true });
    db = createClient({ url: 'file:' + dbPath });
  }
  await initDb(db, {
    adminUser: process.env.AUTH_USER,
    adminPass: process.env.AUTH_PASS,
    resetAdmin: process.env.RESET_ADMIN === '1'
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  🎯 GENERADOR DE QR - CHECKPOINTS     ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
    console.log(useRemote ? '✓ Base de datos: Turso (remota)' : `✓ Base de datos: ${dbPath}`);
    console.log(`\n📱 Abre tu navegador en http://localhost:${PORT}\n`);
  });
}

startServer().catch(err => {
  console.error('Error al inicializar:', err.message);
  process.exit(1);
});
