import { supabaseAdmin } from '../infrastructure/supabaseClient';
import { PostgrestError } from '@supabase/supabase-js';

export async function createTables() {
  try {
    // Check which tables are missing
    const { data: existingTables, error: tableCheckError } = await supabaseAdmin.rpc('get_existing_tables', {
      tableNames: ['users', 'usage_logs', 'tts_jobs', 'chapters', 'voices', 'analytics']
    });

    if (tableCheckError) {
      console.error('Error checking existing tables:', tableCheckError);
      return;
    }

    // If all tables exist, nothing to do
    const allTablesExist = (existingTables || []).length === 6;

    if (allTablesExist) {
      console.log('All tables already exist. No migration needed.');
      return;
    }

    // Compose all SQL statements in a single transaction
    const sql = `
      BEGIN;
      -- Create update_timestamp trigger function
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';

      -- Create users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        full_name TEXT,
        avatar_url TEXT,
        subscription_tier TEXT DEFAULT 'free',
        usage_quota INTEGER DEFAULT 1000,
        usage_count INTEGER DEFAULT 0,
        last_usage_reset TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TRIGGER IF NOT EXISTS update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_subscription_tier ON users(subscription_tier);

      -- Create usage_logs table
      CREATE TABLE IF NOT EXISTS usage_logs (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        character_count INTEGER DEFAULT 0,
        file_size INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_usage_logs_user_id ON usage_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_usage_logs_action ON usage_logs(action);

      -- Create tts_jobs table
      CREATE TABLE IF NOT EXISTS tts_jobs (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        audio_urls JSONB DEFAULT '[]',
        error TEXT,
        progress INTEGER DEFAULT 0,
        total_chapters INTEGER DEFAULT 1,
        processed_chapters INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TRIGGER IF NOT EXISTS update_tts_jobs_updated_at
        BEFORE UPDATE ON tts_jobs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      CREATE INDEX IF NOT EXISTS idx_tts_jobs_user_id ON tts_jobs(user_id);
      CREATE INDEX IF NOT EXISTS idx_tts_jobs_status ON tts_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_tts_jobs_created_at ON tts_jobs(created_at);

      -- Create chapters table
      CREATE TABLE IF NOT EXISTS chapters (
        id SERIAL PRIMARY KEY,
        tts_job_id INTEGER NOT NULL REFERENCES tts_jobs(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        audio_url TEXT NOT NULL,
        duration INTEGER NOT NULL,
        size INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_chapters_tts_job_id ON chapters(tts_job_id);

      -- Create voices table
      CREATE TABLE IF NOT EXISTS voices (
        id SERIAL PRIMARY KEY,
        voice_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_voices_voice_id ON voices(voice_id);

      -- Create analytics table
      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        file_uploads INTEGER DEFAULT 0,
        text_inputs INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        character_count INTEGER DEFAULT 0,
        file_types JSONB DEFAULT '{}',
        voice_usage JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      COMMIT;
    `;

    if (migrationError) {
      console.error('Error running migration transaction:', migrationError);

      return;
    }

    console.log('All tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

// Export for explicit execution
// Run with: import { createTables } from './createTables'; await createTables(); 