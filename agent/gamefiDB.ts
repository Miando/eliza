import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = process.env.DATA_DIR || './data';
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = process.env.SQLITE_FILE || path.resolve(dataDir, 'gamefi_summaries.sqlite');

const db = new Database(dbPath);

// Создание таблицы для хранения саммари и их статуса обработки
db.exec(`
CREATE TABLE IF NOT EXISTS gamefi_knowledge_base (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary TEXT,
  processed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

export { db };
