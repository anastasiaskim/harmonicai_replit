import { supabaseAdmin } from '../infrastructure/supabaseClient';
import { PostgrestError } from '@supabase/supabase-js';

async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `SELECT 1 FROM "${tableName.replace(/"/g, "")}" LIMIT 1;`
    });
    return !error;
  } catch (err) {
    console.error(`Error checking if table ${tableName} exists:`, err);
    return false;
  }
}

async function backupTable(tableName: string): Promise<void> {
  // Generate a unique backup table name by appending a timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupTableName = `${tableName}_backup_${timestamp}`;
  
  // Use proper SQL identifier quoting to prevent SQL injection
  const { error } = await supabaseAdmin.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS "${backupTableName}" AS 
      SELECT * FROM "${tableName}";
    `
  });
  if (error) {
    throw new Error(`Failed to backup ${tableName}: ${error.message}`);
  }
}

export async function convertTimestamps() {
  console.log('Starting timestamp conversion...');
  
  try {
    // Backup tables before destructive operations
    await backupTable('users');
    await backupTable('usage_logs');
    await backupTable('tts_jobs');
    await backupTable('chapters');
    await backupTable('analytics');

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

      -- Convert users table timestamps
      ALTER TABLE users 
        ADD COLUMN last_usage_reset_new TIMESTAMPTZ,
        ADD COLUMN created_at_new TIMESTAMPTZ,
        ADD COLUMN updated_at_new TIMESTAMPTZ;

      UPDATE users SET
        last_usage_reset_new = last_usage_reset::TIMESTAMPTZ,
        created_at_new = created_at::TIMESTAMPTZ,
        updated_at_new = updated_at::TIMESTAMPTZ;

      ALTER TABLE users 
        DROP COLUMN last_usage_reset,
        DROP COLUMN created_at,
        DROP COLUMN updated_at;

      ALTER TABLE users 
        RENAME COLUMN last_usage_reset_new TO last_usage_reset,
        RENAME COLUMN created_at_new TO created_at,
        RENAME COLUMN updated_at_new TO updated_at;

      ALTER TABLE users 
        ALTER COLUMN last_usage_reset SET NOT NULL,
        ALTER COLUMN created_at SET NOT NULL,
        ALTER COLUMN updated_at SET NOT NULL,
        ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
        ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

      -- Convert usage_logs table timestamps
      ALTER TABLE usage_logs 
        ADD COLUMN created_at_new TIMESTAMPTZ;

      UPDATE usage_logs SET
        created_at_new = created_at::TIMESTAMPTZ;

      ALTER TABLE usage_logs 
        DROP COLUMN created_at;

      ALTER TABLE usage_logs 
        RENAME COLUMN created_at_new TO created_at;

      ALTER TABLE usage_logs 
        ALTER COLUMN created_at SET NOT NULL,
        ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

      -- Convert tts_jobs table timestamps
      ALTER TABLE tts_jobs 
        ADD COLUMN created_at_new TIMESTAMPTZ,
        ADD COLUMN updated_at_new TIMESTAMPTZ;

      UPDATE tts_jobs SET
        created_at_new = created_at::TIMESTAMPTZ,
        updated_at_new = updated_at::TIMESTAMPTZ;

      ALTER TABLE tts_jobs 
        DROP COLUMN created_at,
        DROP COLUMN updated_at;

      ALTER TABLE tts_jobs 
        RENAME COLUMN created_at_new TO created_at,
        RENAME COLUMN updated_at_new TO updated_at;

      ALTER TABLE tts_jobs 
        ALTER COLUMN created_at SET NOT NULL,
        ALTER COLUMN updated_at SET NOT NULL,
        ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
        ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

      -- Convert chapters table timestamps
      ALTER TABLE chapters 
        ADD COLUMN created_at_new TIMESTAMPTZ;

      UPDATE chapters SET
        created_at_new = created_at::TIMESTAMPTZ;

      ALTER TABLE chapters 
        DROP COLUMN created_at;

      ALTER TABLE chapters 
        RENAME COLUMN created_at_new TO created_at;

      ALTER TABLE chapters 
        ALTER COLUMN created_at SET NOT NULL,
        ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

      -- Convert analytics table timestamps
      ALTER TABLE analytics 
        ADD COLUMN created_at_new TIMESTAMPTZ;

      UPDATE analytics SET
        created_at_new = created_at::TIMESTAMPTZ;

      ALTER TABLE analytics 
        DROP COLUMN created_at;

      ALTER TABLE analytics 
        RENAME COLUMN created_at_new TO created_at;

      ALTER TABLE analytics 
        ALTER COLUMN created_at SET NOT NULL,
        ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

      COMMIT;
    `;

    const { error: migrationError } = await supabaseAdmin.rpc('exec_sql', { sql });
    if (migrationError) {
      throw new Error(`Failed to execute migration: ${migrationError.message}`);
    }

    console.log('Successfully converted all timestamp columns to TIMESTAMPTZ!');
    console.log('Backup tables have been created with _backup suffix.');
  } catch (error) {
    // Rollback transaction on error

    
    console.error('Error during timestamp conversion:', error);
    console.error('Transaction rolled back. No changes were made to the database.');
    throw error;
  }
} 