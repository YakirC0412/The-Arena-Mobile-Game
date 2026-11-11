// The server's database: one SQLite file (Node's built-in node:sqlite, no extra package).
// Tables: users, sessions (login tokens, stored hashed), games + game_players (for the leaderboard).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = DatabaseSync;

export function openDb(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      finished_at INTEGER NOT NULL,
      humans INTEGER NOT NULL,
      champion_user_id INTEGER REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS game_players (
      game_id INTEGER NOT NULL REFERENCES games(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY (game_id, user_id)
    );
  `);
  // Older database files have no avatar column yet.
  const columns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!columns.some((column) => column.name === 'avatar')) {
    db.exec("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT 'avatar-01'");
  }
  // Hebrew texts need to know if a player is a man or a woman.
  if (!columns.some((column) => column.name === 'gender')) {
    db.exec("ALTER TABLE users ADD COLUMN gender TEXT NOT NULL DEFAULT 'male'");
  }
  // Google sign-in (Firebase): the Firebase user id, and whether the player has chosen nickname / avatar / gender yet.
  if (!columns.some((column) => column.name === 'firebase_uid')) db.exec('ALTER TABLE users ADD COLUMN firebase_uid TEXT');
  if (!columns.some((column) => column.name === 'profile_done')) db.exec('ALTER TABLE users ADD COLUMN profile_done INTEGER NOT NULL DEFAULT 1');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid ON users(firebase_uid)');
  return db;
}

// Leaderboard rule (PRD_MULTIPLAYER, decision 21): a game counts only when 2 or more accounts played it,
// so nobody farms wins against bots. Call once per finished game.
export function recordGame(db: Db, userIds: number[], championUserId: number | null): boolean {
  const unique = [...new Set(userIds)];
  if (unique.length < 2) return false;
  const game = db
    .prepare('INSERT INTO games (finished_at, humans, champion_user_id) VALUES (?, ?, ?)')
    .run(Date.now(), unique.length, championUserId);
  const add = db.prepare('INSERT INTO game_players (game_id, user_id) VALUES (?, ?)');
  for (const id of unique) add.run(game.lastInsertRowid, id);
  return true;
}

export type LeaderRow = { userId: number; name: string; avatar: string; wins: number; games: number };

export function getLeaders(db: Db, limit = 20): LeaderRow[] {
  const rows = db
    .prepare(
      `SELECT u.id AS userId, u.name AS name, u.avatar AS avatar,
              (SELECT COUNT(*) FROM games g WHERE g.champion_user_id = u.id) AS wins,
              (SELECT COUNT(*) FROM game_players p WHERE p.user_id = u.id) AS games
       FROM users u
       WHERE EXISTS (SELECT 1 FROM game_players p WHERE p.user_id = u.id)
       ORDER BY wins DESC, games ASC, u.id ASC
       LIMIT ?`,
    )
    .all(limit) as LeaderRow[];
  return rows.map((row) => ({ ...row }));
}
