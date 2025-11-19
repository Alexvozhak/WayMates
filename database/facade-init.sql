-- Facade Database Initialization Script
-- This script sets up the database schema for the Facade MCP Server

-- Create facade schema for separation
CREATE SCHEMA IF NOT EXISTS facade;

-- Set search path
SET search_path TO facade, public;

-- Users table (migration from SQLite auth.db)
CREATE TABLE IF NOT EXISTS facade.users (
    user_id VARCHAR(36) PRIMARY KEY,  -- UUID v7
    email VARCHAR(255) UNIQUE,
    token_hash VARCHAR(64),  -- SHA256 hash of auth token
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON facade.users(email);

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_users_token_hash ON facade.users(token_hash);

-- Sessions table (optional, if not using Redis exclusively)
-- We'll keep session metadata in PostgreSQL for durability
CREATE TABLE IF NOT EXISTS facade.sessions (
    session_id VARCHAR(36) PRIMARY KEY,  -- UUID v7
    user_id VARCHAR(36) NOT NULL REFERENCES facade.users(user_id) ON DELETE CASCADE,
    thread_id VARCHAR(36) NOT NULL,  -- LangGraph thread_id for checkpointing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Index for user sessions lookup
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON facade.sessions(user_id);

-- Index for expired sessions cleanup
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON facade.sessions(expires_at) WHERE is_active = true;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION facade.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON facade.users
    FOR EACH ROW EXECUTE FUNCTION facade.update_updated_at_column();

-- Note: LangGraph checkpoint tables will be created automatically
-- by PostgresSaver.setup() when the application starts
-- They include: checkpoints, checkpoint_metadata, checkpoint_writes

-- Grant permissions (if specific user is needed)
-- GRANT ALL PRIVILEGES ON SCHEMA facade TO waymates_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA facade TO waymates_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA facade TO waymates_user;