// Copia los checkpoints de tu db/checkpoints.db local a la cuenta de ADMINISTRADOR en Turso.
// Uso (Windows cmd):
//   set TURSO_DATABASE_URL=libsql://...
//   set TURSO_AUTH_TOKEN=...
//   set AUTH_USER=tu_usuario_admin
//   set AUTH_PASS=tu_contraseña_admin
//   node scripts/importar-a-turso.js
import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.TURSO_DATABASE_URL) {
  console.error('Falta TURSO_DATABASE_URL (y TURSO_AUTH_TOKEN).');
  process.exit(1);
}

const local = createClient({ url: 'file:' + path.join(__dirname, '..', 'db', 'checkpoints.db') });
const remote = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

// Crea tablas y el administrador (si aún no existe) en Turso
const adminId = await initDb(remote, {
  adminUser: process.env.AUTH_USER,
  adminPass: process.env.AUTH_PASS
});

const rows = (await local.execute('SELECT name, url, code, created_at FROM checkpoints ORDER BY id')).rows;
let n = 0;
for (const r of rows) {
  const num = parseInt(String(r.code).replace(/\D/g, ''), 10) || 0;
  const res = await remote.execute({
    sql: `INSERT OR IGNORE INTO checkpoints (user_id, name, url, num, code, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [adminId, r.name, r.url, num, r.code, r.created_at]
  });
  n += res.rowsAffected;
}
await remote.execute({
  sql: `UPDATE users SET next_num = MAX(next_num, (SELECT COALESCE(MAX(num), 0) + 1 FROM checkpoints WHERE user_id = ?)) WHERE id = ?`,
  args: [adminId, adminId]
});
console.log(`Listo: ${n} checkpoint(s) importados a la cuenta de administrador (${rows.length} encontrados en local).`);
process.exit(0);
