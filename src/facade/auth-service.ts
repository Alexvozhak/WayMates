import { v7 as uuidv7 } from 'uuid';
import Database from 'better-sqlite3';
import { USERS_TABLE_MIGRATION } from '../../database/migrations/001_users_table.js';
import type { FacadeUser } from './types.js';

export class AuthService {
  constructor(private db: Database.Database) {
    this.initializeDatabase();
  }

  async authenticate(token: string): Promise<string> {
    const stmt = this.db.prepare('SELECT user_id FROM users WHERE token = ?');
    const row = stmt.get(token) as { user_id: string } | undefined;

    if (!row) {
      throw new Error('Invalid token');
    }

    return Promise.resolve(row.user_id);
  }

  async createUser(): Promise<FacadeUser> {
    const userId = `usr_${uuidv7()}`;
    const token = uuidv7();
    const createdAt = Date.now();

    const stmt = this.db.prepare(
      'INSERT INTO users (user_id, token, created_at) VALUES (?, ?, ?)'
    );
    stmt.run(userId, token, createdAt);

    return Promise.resolve({
      userId,
      token,
      createdAt,
    });
  }

  async getUser(userId: string): Promise<FacadeUser | null> {
    const stmt = this.db.prepare(
      'SELECT user_id, token, created_at, last_active_at FROM users WHERE user_id = ?'
    );
    const row = stmt.get(userId) as
      | {
          user_id: string;
          token: string;
          created_at: number;
          last_active_at: number | null;
        }
      | undefined;

    if (!row) {
      return Promise.resolve(null);
    }

    const result: FacadeUser = {
      userId: row.user_id,
      token: row.token,
      createdAt: row.created_at,
    };

    if (row.last_active_at !== null) {
      result.lastActiveAt = row.last_active_at;
    }

    return Promise.resolve(result);
  }

  private initializeDatabase(): void {
    this.db.exec(USERS_TABLE_MIGRATION);
  }
}
