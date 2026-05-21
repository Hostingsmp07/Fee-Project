const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const DB_FILE = process.env.DB_FILE || 'database.sqlite';

let dbPromise;

async function getDb() {
  if (!dbPromise) {
    dbPromise = open({
      filename: path.join(__dirname, '..', DB_FILE),
      driver: sqlite3.Database,
    });

    const db = await dbPromise;

    await db.exec('PRAGMA foreign_keys = ON');

    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        title TEXT NOT NULL,
        goalHours INTEGER NOT NULL,
        difficulty TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        planId INTEGER NOT NULL,
        durationSeconds INTEGER NOT NULL,
        loggedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (planId) REFERENCES plans(id) ON DELETE CASCADE
      );
    `);

    // Add note column if missing
    try { await db.exec(`ALTER TABLE sessions ADD COLUMN note TEXT DEFAULT ''`); } catch(e) {}
  }

  return dbPromise;
}

module.exports = { getDb };