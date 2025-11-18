// Facade SQLite: Users table migration
// Created: 2025-11-03
// Purpose: Store user authentication tokens (UUID v7, permanent)

export const USERS_TABLE_MIGRATION = `
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL,
    last_active_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);
`;
