import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

// ---------- Contraseñas (scrypt, sin dependencias externas) ----------
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(hashHex, 'hex');
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// ---------- Esquema y migraciones ----------
// Crea tablas si faltan, crea el administrador inicial y migra los
// checkpoints de versiones anteriores (sin usuario) a la cuenta del admin.
export async function initDb(db, { adminUser, adminPass, resetAdmin } = {}) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      next_num INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  // Administrador inicial
  let admin = (await db.execute('SELECT id FROM users WHERE is_admin = 1 ORDER BY id LIMIT 1')).rows[0];
  if (!admin) {
    if (!adminUser || !adminPass) {
      throw new Error('No existe administrador. Define AUTH_USER y AUTH_PASS para crearlo.');
    }
    if (adminPass.length < 8) {
      throw new Error('AUTH_PASS debe tener al menos 8 caracteres.');
    }
    const r = await db.execute({
      sql: 'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)',
      args: [adminUser, await hashPassword(adminPass)]
    });
    admin = { id: Number(r.lastInsertRowid) };
    console.log(`✓ Administrador creado: ${adminUser}`);
  } else if (resetAdmin && adminPass) {
    await db.execute({
      sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
      args: [await hashPassword(adminPass), admin.id]
    });
    await db.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [admin.id] });
    console.log('✓ Contraseña del administrador restablecida (quita RESET_ADMIN después).');
  }
  const adminId = Number(admin.id);

  // Tabla de checkpoints (nueva o migrada)
  const cols = (await db.execute("PRAGMA table_info('checkpoints')")).rows.map(r => r.name);
  const createNew = (name) => `
    CREATE TABLE ${name} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      num INTEGER NOT NULL,
      code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, code)
    )`;

  if (cols.length === 0) {
    await db.execute(createNew('checkpoints'));
  } else if (!cols.includes('user_id')) {
    // Versión anterior: todos los QR pasan al administrador conservando su código.
    await db.batch([
      createNew('checkpoints_new'),
      {
        sql: `INSERT INTO checkpoints_new (id, user_id, name, url, num, code, created_at)
              SELECT id, ?, name, url, id, code, created_at FROM checkpoints`,
        args: [adminId]
      },
      'DROP TABLE checkpoints',
      'ALTER TABLE checkpoints_new RENAME TO checkpoints',
      {
        sql: `UPDATE users SET next_num = (SELECT COALESCE(MAX(num), 0) + 1 FROM checkpoints WHERE user_id = ?) WHERE id = ?`,
        args: [adminId, adminId]
      }
    ], 'write');
    console.log('✓ Checkpoints anteriores asignados al administrador.');
  }
  await db.execute('CREATE INDEX IF NOT EXISTS idx_checkpoints_user ON checkpoints (user_id)');

  // Limpiar sesiones vencidas
  await db.execute({ sql: 'DELETE FROM sessions WHERE expires_at < ?', args: [Date.now()] });
  return adminId;
}
