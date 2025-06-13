import { supabaseAdmin } from '../infrastructure/supabaseClient';
import { PostgrestError } from '@supabase/supabase-js';
import format from 'pg-format';

// Cache for table existence checks
const tableExistenceCache = new Map<string, { exists: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Checks if a table exists in the database
 * @param tableName Name of the table to check
 * @param schema Schema name to check (defaults to 'public')
 * @param useCache Whether to use the cache (defaults to true)
 * @returns Promise<boolean> True if table exists, false if it doesn't exist
 * @throws Error for any database errors other than table not existing
 */
async function checkTableExists(
  tableName: string, 
  schema: string = 'public',
  useCache: boolean = true
): Promise<boolean> {
  const cacheKey = `${schema}.${tableName}`;
  
  // Check cache if enabled
  if (useCache) {
    const cachedResult = tableExistenceCache.get(cacheKey);
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
      console.log(`[Cache] Table ${schema}.${tableName} exists: ${cachedResult.exists}`);
      return cachedResult.exists;
    }
  }

  try {
    console.log(`[DB] Checking existence of table ${schema}.${tableName}...`);
    const sql = format(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = %L
        AND table_name = %L
      );`,
      schema,
      tableName
    );
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql });

    if (error) {
      // Check for Supabase's specific error codes
      if (error.code === 'PGRST116' || (error.details && error.details.includes('table not found'))) {
        console.log(`[DB] Table ${schema}.${tableName} does not exist (Error: ${error.code})`);
        if (useCache) {
          tableExistenceCache.set(cacheKey, { exists: false, timestamp: Date.now() });
        }
        return false;
      }
      
      // For any other error, throw it to be handled by the caller
      console.error(`[DB] Error checking table ${schema}.${tableName}:`, {
        code: error.code,
        message: error.message,
        details: error.details
      });
      throw new Error(`Database error checking table ${schema}.${tableName}: ${error.message}`);
    }

    const exists = data[0]?.exists || false;
    console.log(`[DB] Table ${schema}.${tableName} exists: ${exists}`);
    
    if (useCache) {
      tableExistenceCache.set(cacheKey, { exists, timestamp: Date.now() });
    }
    
    return exists;
  } catch (err) {
    const error = err as PostgrestError;
    
    // Handle PostgrestError specifically
    if (error.code === 'PGRST116' || (error.details && error.details.includes('table not found'))) {
      console.log(`[DB] Table ${schema}.${tableName} does not exist (Error: ${error.code})`);
      if (useCache) {
        tableExistenceCache.set(cacheKey, { exists: false, timestamp: Date.now() });
      }
      return false;
    }
    
    // For any other error, rethrow with context
    console.error(`[DB] Unexpected error checking table ${schema}.${tableName}:`, {
      code: error.code,
      message: error.message,
      details: error.details
    });
    throw new Error(`Unexpected error checking table ${schema}.${tableName}: ${error.message}`);
  }
}

/**
 * Clears the table existence cache
 * @param tableName Optional table name to clear specific cache entry
 * @param schema Optional schema name to clear specific cache entry
 */
export function clearTableExistenceCache(tableName?: string, schema?: string): void {
  if (tableName && schema) {
    tableExistenceCache.delete(`${schema}.${tableName}`);
    console.log(`[Cache] Cleared cache for table ${schema}.${tableName}`);
  } else {
    tableExistenceCache.clear();
    console.log('[Cache] Cleared all table existence cache');
  }
}

/**
 * Checks if a column exists in a table
 * @param tableName Name of the table to check
 * @param columnName Name of the column to check
 * @returns Promise<boolean> True if column exists, false if it doesn't exist
 * @throws Error for any database errors
 */
async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql: format(`
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.columns 
          WHERE table_name = %L 
          AND column_name = %L
        );
      `, tableName, columnName)
    });

    if (error) {
      throw new Error(`Database error checking column ${columnName} in ${tableName}: ${error.message}`);
    }

    return data[0]?.exists || false;
  } catch (err) {
    const error = err as Error;
    throw new Error(`Failed to check column ${columnName} in ${tableName}: ${error.message}`);
  }
}

/**
 * Safely executes SQL statements for a table's timestamp rollback
 * @param tableName Name of the table to rollback
 * @param columns Array of column names to rollback
 * @returns Promise<void>
 */
async function rollbackTableTimestamps(tableName: string, columns: string[]): Promise<void> {
  console.log(`Checking columns in ${tableName} table...`);
  
  // Check which columns exist
  const existingColumns = await Promise.all(
    columns.map(async (column) => ({
      name: column,
      exists: await checkColumnExists(tableName, column)
    }))
  );

  const columnsToRollback = existingColumns.filter(col => col.exists);
  
  if (columnsToRollback.length === 0) {
    console.log(`No timestamp columns found in ${tableName} table, skipping...`);
    return;
  }

  console.log(`Rolling back ${columnsToRollback.length} columns in ${tableName} table...`);

  // Build the SQL statements based on existing columns
  const addColumnsSQL = columnsToRollback
    .map(col => format('ADD COLUMN %I_old TEXT', col.name))
    .join(',\n          ');

  const updateColumnsSQL = columnsToRollback
    .map(col => `${col.name}_old = ${col.name}::TEXT`)
    .join(',\n          ');

  const dropColumnsSQL = columnsToRollback
    .map(col => `DROP COLUMN ${col.name}`)
    .join(',\n          ');

  const renameColumnsSQL = columnsToRollback
    .map(col => `RENAME COLUMN ${col.name}_old TO ${col.name}`)
    .join(',\n          ');

  const alterNotNullSQL = columnsToRollback
    .map(col => `ALTER COLUMN ${col.name} SET NOT NULL`)
    .join(',\n          ');

  const { error } = await supabaseAdmin.rpc('exec_sql', {
    sql: `
      -- First, add new columns with TEXT type
      ALTER TABLE ${tableName} 
          ${addColumnsSQL};

      -- Convert existing TIMESTAMPTZ to TEXT
      UPDATE ${tableName} SET
          ${updateColumnsSQL};

      -- Drop old columns and rename new ones
      ALTER TABLE ${tableName} 
          ${dropColumnsSQL};

      ALTER TABLE ${tableName} 
          ${renameColumnsSQL};

      -- Add NOT NULL constraints
      ALTER TABLE ${tableName} 
          ${alterNotNullSQL};
    `
  });

  if (error) {
    throw new Error(`Failed to rollback ${tableName} table: ${error.message}`);
  }

  console.log(`Successfully rolled back ${columnsToRollback.length} columns in ${tableName} table`);
}

async function backupTable(tableName: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc('exec_sql', {
    sql: format(`
      CREATE TABLE IF NOT EXISTS %I AS 
      SELECT * FROM %I;
    `, `${tableName}_rollback_backup`, tableName)
  });
  if (error) {
    throw new Error(`Failed to backup ${tableName}: ${error.message}`);
  }
}

export async function rollbackTimestamps() {
  console.log('Starting timestamp rollback...');
  
  try {
    // Create a SQL function that encapsulates all rollback operations
    const { error: createFunctionError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION rollback_timestamps()
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        DECLARE
          table_record RECORD;
          column_record RECORD;
          backup_exists BOOLEAN;
          is_nullable BOOLEAN;
        BEGIN
          -- Create backups for all tables
          FOR table_record IN 
            SELECT unnest(ARRAY['users', 'usage_logs', 'tts_jobs', 'chapters', 'analytics']) AS table_name
          LOOP
            EXECUTE format('SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %L)', table_record.table_name) INTO backup_exists;
            IF backup_exists THEN
              EXECUTE format('CREATE TABLE IF NOT EXISTS %I_rollback_backup AS SELECT * FROM %I', 
                table_record.table_name, table_record.table_name);
            END IF;
          END LOOP;

          -- Rollback timestamps for each table
          FOR table_record IN 
            SELECT unnest(ARRAY['users', 'usage_logs', 'tts_jobs', 'chapters', 'analytics']) AS table_name
          LOOP
            -- Check if table exists
            EXECUTE format('SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %L)', table_record.table_name) INTO backup_exists;
            IF backup_exists THEN
              -- Add new columns with TEXT type
              EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS last_usage_reset_old TEXT, 
                ADD COLUMN IF NOT EXISTS created_at_old TEXT, 
                ADD COLUMN IF NOT EXISTS updated_at_old TEXT', table_record.table_name);

              -- Convert existing TIMESTAMPTZ to TEXT
              EXECUTE format('UPDATE %I SET 
                last_usage_reset_old = last_usage_reset::TEXT,
                created_at_old = created_at::TEXT,
                updated_at_old = updated_at::TEXT', table_record.table_name);

              -- Drop old columns and rename new ones
              EXECUTE format('ALTER TABLE %I 
                DROP COLUMN IF EXISTS last_usage_reset,
                DROP COLUMN IF EXISTS created_at,
                DROP COLUMN IF EXISTS updated_at', table_record.table_name);

              EXECUTE format('ALTER TABLE %I 
                RENAME COLUMN last_usage_reset_old TO last_usage_reset,
                RENAME COLUMN created_at_old TO created_at,
                RENAME COLUMN updated_at_old TO updated_at', table_record.table_name);

              -- Check and apply original nullability constraints
              FOR column_record IN 
                SELECT column_name, is_nullable 
                FROM information_schema.columns 
                WHERE table_name = table_record.table_name 
                AND column_name IN ('last_usage_reset', 'created_at', 'updated_at')
              LOOP
                -- Only apply NOT NULL if the column was originally NOT NULL
                IF column_record.is_nullable = 'NO' THEN
                  EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET NOT NULL', 
                    table_record.table_name, column_record.column_name);
                END IF;
              END LOOP;
            END IF;
          END LOOP;

          -- Drop the update_updated_at_column trigger function
          DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
        END;
        $$;
      `
    });

    if (createFunctionError) {
      throw new Error(`Failed to create rollback function: ${createFunctionError.message}`);
    }

    // Execute the rollback function
    const { error: executeError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'SELECT rollback_timestamps();'
    });

    if (executeError) {
      throw new Error(`Failed to execute rollback: ${executeError.message}`);
    }

    console.log('Successfully rolled back all timestamp columns to TEXT!');
    console.log('Backup tables have been created with _rollback_backup suffix.');
  } catch (error) {
    console.error('Error during timestamp rollback:', error);
    throw error;
  }
} 