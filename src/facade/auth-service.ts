import { v7 as uuidv7 } from 'uuid';

import { USERS_TABLE_MIGRATION } from '../../database/migrations/001_users_table.js';

import type { FacadeUser } from './types.js';
import type database from 'better-sqlite3';

export class AuthService {
  constructor(private db: database.database) {
    this.initializeDatabase();
  }

  authenticate(token: string): string {
    const stmt = this.db.prepare('SELECT user_id FROM users WHERE token = ?');
    const row = stmt.get(token) as { userId: string } | undefined;

    if (!row) {
      throw new Error('Invalid token');
    }

    return row.user_id;
  }

  createUser(): FacadeUser {
    const userId = `usr_${uuidv7()}`;
    const token = uuidv7();
    const createdAt = Date.now();

    const stmt = this.db.prepare(
      'INSERT INTO users (user_id, token, created_at) VALUES (?, ?, ?)'
    );
    stmt.run(userId, token, createdAt);

    return {
      userId,
      token,
      createdAt,
    };
  }

  getUser(userId: string): FacadeUser | null {
    const stmt = this.db.prepare(
      'SELECT user_id, token, created_at, last_active_at FROM users WHERE user_id = ?'
    );
    const row = stmt.get(userId) as
      | {
          userId: string;
          token: string;
          createdAt: number;
          lastActiveAt: number | null;
        }
      | undefined;

    if (!row) {
      return null;
    }

    const result: FacadeUser = {
      userId: row.user_id,
      token: row.token,
      createdAt: row.created_at,
    };

    if (row.last_active_at !== null) {
      result.lastActiveAt = row.last_active_at;
    }

    return result;
  }

  private initializeDatabase(): void {
    this.db.exec(USERS_TABLE_MIGRATION);
  }
}
