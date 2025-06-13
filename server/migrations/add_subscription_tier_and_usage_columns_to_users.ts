import { sql } from "drizzle-orm";

export const up = async (db: any) => {
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS "subscription_tier" TEXT DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS "last_usage_reset" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

    -- Add trigger to automatically update updated_at
    CREATE OR REPLACE FUNCTION update_users_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_users_updated_at_column();
  `);
};

export const down = async (db: any) => {
  await db.execute(sql`
    -- Drop the trigger first
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    DROP FUNCTION IF EXISTS update_users_updated_at_column();

    -- Then drop the columns
    ALTER TABLE users
      DROP COLUMN IF EXISTS "subscription_tier",
      DROP COLUMN IF EXISTS "last_usage_reset",
      DROP COLUMN IF EXISTS "created_at",
      DROP COLUMN IF EXISTS "updated_at";
  `);
}; 