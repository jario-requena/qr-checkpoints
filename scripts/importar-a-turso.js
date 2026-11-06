// Copia los checkpoints de tu db/checkpoints.db local a Turso.
// Uso:  TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/importar-a-turso.js
import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const local = createClient({ url: 'file:' + path.join(__dirname, '..', 'db', 'checkpoints.db') });

if (!process.env.TURSO_DATABASE_URL) {
  console.error('Falta TURSO_DATABASE_URL (y TURSO_AUTH_TOKEN).');
  process.exit(1);
}
const remote = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

await remote.execute(`
  CREATE TABLE IF NOT EXISTS checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const rows = (await local.execute('SELECT id, name, url, code, created_at FROM checkpoints ORDER BY id')).rows;
let n = 0;
for (const r of rows) {
  const res = await remote.execute({
    sql: 'INSERT OR IGNORE INTO checkpoints (id, name, url, code, created_at) VALUES (?, ?, ?, ?, ?)',
    args: [r.id, r.name, r.url, r.code, r.created_at]
  });
  n += res.rowsAffected;
}
console.log(`Listo: ${n} checkpoint(s) importados (${rows.length} encontrados en local).`);
process.exit(0);
