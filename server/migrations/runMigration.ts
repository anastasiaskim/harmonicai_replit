import { createTables } from './createTables';

async function runMigration() {
  try {
    console.log('Starting database migration...');
    await createTables();
    console.log('Database migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration(); 