import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// Configuration for connection retries
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Add connection timeout
  connectionTimeoutMillis: 5000,
  // Add idle timeout
  idleTimeoutMillis: 30000,
  // Add max number of clients
  max: 20,
});

// Use a mutex to ensure only one retry process runs at a time
let isRetrying = false;

/**
 * Sanitizes error information to prevent exposure of sensitive data
 * @param error The error to sanitize
 * @returns A sanitized error object with sensitive information removed
 */
const sanitizeError = (error: Error): { message: string; code?: string; type: string; timestamp: string } => {
  const sanitized = {
    message: error.message,
    code: (error as any).code,
    type: error.name,
    timestamp: new Date().toISOString()
  };

  // Remove any potential connection string information
  if (sanitized.message.includes('DATABASE_URL') || sanitized.message.includes('connection')) {
    sanitized.message = sanitized.message.replace(/postgres:\/\/[^@]+@[^/]+\/[^?\s]+/, 'postgres://***:***@***/***');
  }

  // Remove any potential credential information
  sanitized.message = sanitized.message.replace(/password=([^&\s]+)/, 'password=***');
  sanitized.message = sanitized.message.replace(/user=([^&\s]+)/, 'user=***');

  return sanitized;
};

const handleConnectionError = async (err: Error, client?: PoolClient) => {
  const sanitizedError = sanitizeError(err);
  console.error('Database connection error:', sanitizedError);

  // Handle specific error types with sanitized messages
  if ((err as any).code === 'ECONNREFUSED') {
    console.error('Database connection refused. Check if the database is running.');
  } else if ((err as any).code === 'ETIMEDOUT') {
    console.error('Database connection timed out. Check network connectivity.');
  } else if ((err as any).code === '28P01') {
    console.error('Invalid database credentials.');
  }

  // Implement retry logic for connection errors
  if (!isRetrying) {
    isRetrying = true;
    let localRetryCount = 0;

    while (localRetryCount < MAX_RETRIES) {
      localRetryCount++;
      console.log(`Attempting to reconnect (${localRetryCount}/${MAX_RETRIES})...`);
      
      try {
        if (client) {
          client.release(err); // Mark the connection as errored
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        
        // Test the connection
        const testClient = await pool.connect();
        testClient.release();
        
        console.log('Successfully reconnected to the database');
        break; // Exit the loop on success
      } catch (retryError) {
        const sanitizedRetryError = sanitizeError(retryError as Error);
        console.error('Reconnection attempt failed:', sanitizedRetryError);
      }
    }

    if (localRetryCount >= MAX_RETRIES) {
      console.error('Max retry attempts reached. Please check database configuration.');
    }

    isRetrying = false; // Release the mutex
  } else {
    console.log('Another retry process is already in progress.');
  }
};

// Handle pool errors
pool.on('error', (err, client) => {
  handleConnectionError(err, client);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  try {
    await pool.end();
    console.log('Database pool closed successfully');
    process.exit(0);
  } catch (err) {
    const sanitizedError = sanitizeError(err as Error);
    console.error('Error closing database pool:', sanitizedError);
    process.exit(1);
  }
});

export const db = drizzle(pool);