import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'sql-formatter';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('SUPABASE_URL:', !supabaseUrl ? 'missing' : 'set');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !supabaseServiceKey ? 'missing' : 'set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Gets the migration file path from command line arguments or environment variable
 * @returns The path to the migration file
 * @throws Error if no valid migration path is provided
 */
function getMigrationPath(): string {
  // Check command line arguments first
  const args = process.argv.slice(2);
  if (args.length > 0) {
    const providedPath = args[0];
    // If it's a relative path, resolve it relative to the migrations directory
    if (!path.isAbsolute(providedPath)) {
      return path.join(process.cwd(), 'server/migrations', providedPath);
    }
    return providedPath;
  }

  // Check environment variable
  const envPath = process.env.MIGRATION_FILE;
  if (envPath) {
    if (!path.isAbsolute(envPath)) {
      return path.join(process.cwd(), 'server/migrations', envPath);
    }
    return envPath;
  }

  // No valid path provided
  throw new Error(
    'No migration file specified. Please provide a path either as a command line argument ' +
    'or through the MIGRATION_FILE environment variable.\n' +
    'Example: npm run migrate my_migration.sql\n' +
    'Or: MIGRATION_FILE=my_migration.sql npm run migrate'
  );
}

/**
 * Validates that the migration file exists and is readable
 * @param filePath Path to the migration file
 * @throws Error if the file is invalid
 */
function validateMigrationFile(filePath: string): void {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration file not found: ${filePath}`);
    }

    // Check if it's a file
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    // Check if it's readable
    fs.accessSync(filePath, fs.constants.R_OK);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid migration file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Extracts metadata from SQL content without exposing sensitive data
 * @param sql The SQL content to analyze
 * @returns Object containing safe metadata about the SQL
 */
function extractSqlMetadata(sql: string): { 
  operationType: string;
  tableCount: number;
  statementCount: number;
  hasSensitiveOperations: boolean;
} {
  // Count statements by type
  const createCount = (sql.match(/CREATE\s+(?:TABLE|FUNCTION|INDEX|TRIGGER)/gi) || []).length;
  const alterCount = (sql.match(/ALTER\s+TABLE/gi) || []).length;
  const dropCount = (sql.match(/DROP\s+(?:TABLE|FUNCTION|INDEX|TRIGGER)/gi) || []).length;
  const insertCount = (sql.match(/INSERT\s+INTO/gi) || []).length;
  const updateCount = (sql.match(/UPDATE\s+/gi) || []).length;
  const deleteCount = (sql.match(/DELETE\s+FROM/gi) || []).length;
  
  // Count affected tables
  const tableMatches = sql.match(/(?:FROM|INTO|UPDATE|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi) || [];
  const uniqueTables = new Set(tableMatches.map(m => m.split(/\s+/)[1].toLowerCase()));
  
  // Check for potentially sensitive operations
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /credential/i,
    /auth/i
  ];
  const hasSensitiveOperations = sensitivePatterns.some(pattern => pattern.test(sql));
  
  // Determine primary operation type
  let operationType = 'UNKNOWN';
  if (createCount > 0) operationType = 'CREATE';
  else if (alterCount > 0) operationType = 'ALTER';
  else if (dropCount > 0) operationType = 'DROP';
  else if (insertCount > 0) operationType = 'INSERT';
  else if (updateCount > 0) operationType = 'UPDATE';
  else if (deleteCount > 0) operationType = 'DELETE';
  
  return {
    operationType,
    tableCount: uniqueTables.size,
    statementCount: createCount + alterCount + dropCount + insertCount + updateCount + deleteCount,
    hasSensitiveOperations
  };
}

/**
 * Executes SQL statements within a transaction
 * @param sql The SQL content to execute
 */
async function executeSQL(sql: string): Promise<void> {
  try {
    // Extract and log safe metadata about the SQL
    const metadata = extractSqlMetadata(sql);
    console.log('Executing SQL with the following metadata:');
    console.log('-------------------');
    console.log(`Operation Type: ${metadata.operationType}`);
    console.log(`Tables Affected: ${metadata.tableCount}`);
    console.log(`Total Statements: ${metadata.statementCount}`);
    if (metadata.hasSensitiveOperations) {
      console.log('Warning: SQL contains potentially sensitive operations');
    }
    console.log('-------------------');

    // Wrap the entire SQL in a transaction
    const wrappedSQL = `
      BEGIN;
      ${sql}
      COMMIT;
    `;

    const { error } = await supabase.rpc('exec_sql', { sql: wrappedSQL });
    
    if (error) {
      console.error('SQL execution error:', error.message);
      
      // Attempt to rollback, but don't let rollback failure mask the original error
      try {
        const { error: rollbackError } = await supabase.rpc('exec_sql', { sql: 'ROLLBACK;' });
        if (rollbackError) {
          console.error('Warning: Failed to rollback transaction:', rollbackError.message);
        } else {
          console.log('Transaction rolled back successfully');
        }
      } catch (rollbackError) {
        console.error('Warning: Exception during rollback:', rollbackError instanceof Error ? rollbackError.message : 'Unknown error');
      }
      
      throw new Error(`SQL execution error: ${error.message}`);
    }
  } catch (error) {
    console.error('Error executing SQL:', error);
    throw error;
  }
}

async function runMigration() {
  try {
    // Get and validate the migration file path
    const migrationPath = getMigrationPath();
    validateMigrationFile(migrationPath);
    
    console.log(`Running migration from: ${migrationPath}`);

    // Read the migration file
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the entire SQL file within a transaction
    await executeSQL(migrationSQL);

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration(); 