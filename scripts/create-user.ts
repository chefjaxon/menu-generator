/**
 * Create a user account.
 * Usage: npx tsx scripts/create-user.ts <username> <password>
 */

import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

const DB_PATH = path.join(process.cwd(), 'data', 'menu-generator.db');

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Ensure users table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx tsx scripts/create-user.ts <username> <password>');
  process.exit(1);
}

const [username, password] = args;

// Check if user already exists
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (existing) {
  console.error(`User "${username}" already exists.`);
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(nanoid(), username, hash);

console.log(`User "${username}" created successfully.`);
db.close();
