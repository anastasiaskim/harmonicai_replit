-- Migration: Ensure users.subscription_tier defaults to 'free' and update existing nulls

DO $$
BEGIN
    -- Check if the column exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'subscription_tier'
        AND table_schema = 'public'
    ) THEN
        -- Set default value
        ALTER TABLE users ALTER COLUMN subscription_tier SET DEFAULT 'free';
        
        -- Update existing null values
        UPDATE users SET subscription_tier = 'free' 
        WHERE subscription_tier IS NULL OR subscription_tier = '';
        
        -- Notify success
        RAISE NOTICE 'Successfully updated subscription_tier column';
    ELSE
        RAISE NOTICE 'Column subscription_tier does not exist in users table';
    END IF;
END $$; 