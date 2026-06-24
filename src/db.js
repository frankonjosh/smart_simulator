import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { config } from "./config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, "..", "migrations");

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new Database(config.dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Migrations runner ──────────────────────────────────────────────────────
// Cheap as it gets: a single table tracking applied filenames, applied in
// lexical order. Each .sql is wrapped in a transaction so a half-applied
// migration cannot corrupt the schema on a crash. SQL comes from bundled
// files in migrations/ — never from user input.

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function runMigrations() {
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const already = new Set(
    db.prepare("SELECT filename FROM schema_migrations").all().map((r) => r.filename),
  );
  const insert = db.prepare("INSERT INTO schema_migrations(filename) VALUES (?)");

  for (const f of files) {
    if (already.has(f)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, f), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      insert.run(f);
    });
    tx();
    console.log(`migration applied: ${f}`);
  }
}

runMigrations();
