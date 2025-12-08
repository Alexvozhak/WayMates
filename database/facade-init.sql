-- Facade Database Initialization Script
-- This script sets up the database schema for the Facade MCP Server

-- Create facade schema for separation
CREATE SCHEMA IF NOT EXISTS facade;

-- Set search path
SET search_path TO facade, public;

-- Users table
CREATE TABLE IF NOT EXISTS facade.users (
    user_id VARCHAR(40) PRIMARY KEY,  -- usr_ + UUID v7
    token_hash VARCHAR(64) NOT NULL,  -- SHA256 hash of auth token
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_users_token_hash ON facade.users(token_hash);

-- Cold start completions tracking
CREATE TABLE IF NOT EXISTS facade.cold_start_completions (
    user_id VARCHAR(40) PRIMARY KEY REFERENCES facade.users(user_id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

-- Function to cleanup checkpoints when user is deleted
CREATE OR REPLACE FUNCTION facade.cleanup_checkpoints_on_user_delete()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM facade.checkpoints WHERE thread_id = 'thread_' || OLD.user_id;
    DELETE FROM facade.checkpoint_blobs WHERE thread_id = 'thread_' || OLD.user_id;
    DELETE FROM facade.checkpoint_writes WHERE thread_id = 'thread_' || OLD.user_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to cleanup checkpoints on user deletion
CREATE TRIGGER cleanup_checkpoints_trigger
BEFORE DELETE ON facade.users
FOR EACH ROW EXECUTE FUNCTION facade.cleanup_checkpoints_on_user_delete();

-- Note: LangGraph checkpoint tables will be created automatically
-- by PostgresSaver.setup() when the application starts
-- They include: checkpoints, checkpoint_metadata, checkpoint_writes

-- Grant permissions (if specific user is needed)
-- GRANT ALL PRIVILEGES ON SCHEMA facade TO waymates_user;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA facade TO waymates_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA facade TO waymates_user;