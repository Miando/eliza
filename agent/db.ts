import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = process.env.DATA_DIR || './data';
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, {recursive: true});
}
const dbPath = process.env.SQLITE_FILE || path.resolve(dataDir, 'db.sqlite');

const db = new Database(dbPath);

// Create the processed_news table if not exists
db.exec(`
CREATE TABLE IF NOT EXISTS processed_news (
  url TEXT PRIMARY KEY,
  processed_at TEXT,
  parse_status TEXT
);
`);

// Ensure 'agent_id' column exists in processed_news table
const processedNewsColumns = db.prepare(`PRAGMA table_info(processed_news)`).all();
const hasAgentId = processedNewsColumns.some(column => column.name === 'agent_id');
if (!hasAgentId) {
    db.exec(`ALTER TABLE processed_news ADD COLUMN agent_id TEXT`);
}

// Create a table for news if you need it
// For simplicity, we won't store multiple articles long-term here, just processed references
db.exec(`
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT,
  title TEXT,
  description TEXT,
  full_text TEXT,
  published_at TEXT,
  url TEXT UNIQUE,
  posted INTEGER DEFAULT 0,
  parse_status TEXT DEFAULT 'pending'
);
`);

export {db};
