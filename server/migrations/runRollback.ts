#!/usr/bin/env node

import { rollbackTimestamps } from './rollbackTimestamps';
import readline from 'readline';

async function main() {
  // Safety check: Only allow in development or staging
  const env = process.env.NODE_ENV;
  if (env !== 'development' && env !== 'staging') {
    console.error(`ERROR: Rollback can only be run in development or staging environments. Current NODE_ENV: ${env}`);
    process.exit(1);
  }

  // User confirmation prompt
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    rl.question(
      'WARNING: This operation is DESTRUCTIVE and will rollback timestamp columns. Are you sure you want to continue? Type "yes" to proceed: ',
      async (answer) => {
        rl.close();
        if (answer.trim().toLowerCase() !== 'yes') {
          console.log('Rollback cancelled by user.');
          process.exit(0);
        }
        try {
          console.log('Starting timestamp rollback process...');
          await rollbackTimestamps();
          console.log('Timestamp rollback completed successfully.');
          process.exit(0);
        } catch (error) {
          console.error('Rollback failed:', error);
          process.exit(1);
        }
        resolve();
      }
    );
  });
}

// Only run if this file is being executed directly
if (require.main === module) {
  main();
} 