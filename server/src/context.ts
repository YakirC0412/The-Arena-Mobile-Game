// The one database the whole server shares (opened in index.ts; tests set their own).
import type { Db } from './db';

let shared: Db | null = null;

export function setDb(db: Db): void {
  shared = db;
}

export function getDb(): Db {
  if (!shared) throw new Error('The database is not open yet');
  return shared;
}
