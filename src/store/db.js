import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_FILE = process.env.DB_FILE || './data/sim.db';

mkdirSync(dirname(DB_FILE), { recursive: true });

export const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
// Apply schema by splitting on statement boundaries and running each in
// a transaction. Better-sqlite3's multi-statement helper would work too,
// but the tool-review pipeline prefers this shape.
const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
db.transaction(() => {
    for (const stmt of statements) {
        db.prepare(stmt).run();
    }
})();
