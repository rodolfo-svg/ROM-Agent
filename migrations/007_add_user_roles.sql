-- Migration 007: Add role column to users table
-- Created: 2026-02-03
-- Purpose: Add role-based access control for system prompts and multi-tenant features

-- Add role column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'role'
    ) THEN
        ALTER TABLE users
        ADD COLUMN role VARCHAR(50) DEFAULT 'user';

        -- Add constraint for valid roles
        ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('user', 'admin', 'partner_admin', 'master_admin'));

        -- Create index for role-based queries
        CREATE INDEX idx_users_role ON users(role);

        RAISE NOTICE 'Column role added to users table';
    ELSE
        RAISE NOTICE 'Column role already exists in users table';
    END IF;
END $$;

-- Add partnerId column if it doesn't exist (for multi-tenant support)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'partner_id'
    ) THEN
        ALTER TABLE users
        ADD COLUMN partner_id VARCHAR(255);

        -- Create index for partner-based queries
        CREATE INDEX idx_users_partner_id ON users(partner_id);

        RAISE NOTICE 'Column partner_id added to users table';
    ELSE
        RAISE NOTICE 'Column partner_id already exists in users table';
    END IF;
END $$;

-- Add name column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'name'
    ) THEN
        ALTER TABLE users
        ADD COLUMN name VARCHAR(255);

        RAISE NOTICE 'Column name added to users table';
    ELSE
        RAISE NOTICE 'Column name already exists in users table';
    END IF;
END $$;

-- Add oab column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'oab'
    ) THEN
        ALTER TABLE users
        ADD COLUMN oab VARCHAR(50);

        RAISE NOTICE 'Column oab added to users table';
    ELSE
        RAISE NOTICE 'Column oab already exists in users table';
    END IF;
END $$;

-- Add password policy columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'password_changed_at'
    ) THEN
        ALTER TABLE users
        ADD COLUMN password_changed_at TIMESTAMP DEFAULT NOW();

        RAISE NOTICE 'Column password_changed_at added to users table';
    ELSE
        RAISE NOTICE 'Column password_changed_at already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'password_expires_at'
    ) THEN
        ALTER TABLE users
        ADD COLUMN password_expires_at TIMESTAMP;

        RAISE NOTICE 'Column password_expires_at added to users table';
    ELSE
        RAISE NOTICE 'Column password_expires_at already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE users
        ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();

        RAISE NOTICE 'Column updated_at added to users table';
    ELSE
        RAISE NOTICE 'Column updated_at already exists';
    END IF;
END $$;

-- Update existing users to have default role 'user' if NULL
UPDATE users SET role = 'user' WHERE role IS NULL;

-- Update primary ROM user to master_admin (if exists)
DO $$
DECLARE
    rom_user_id INTEGER;
BEGIN
    -- Find user by email (common ROM users)
    SELECT id INTO rom_user_id FROM users
    WHERE email IN ('rodolfo@rom.adv.br', 'admin@rom.adv.br', 'master@rom.adv.br')
    LIMIT 1;

    IF rom_user_id IS NOT NULL THEN
        UPDATE users
        SET role = 'master_admin',
            partner_id = 'rom',
            updated_at = NOW()
        WHERE id = rom_user_id;

        RAISE NOTICE 'User upgraded to master_admin: ID=%', rom_user_id;
    ELSE
        -- If no ROM user found, upgrade the first user to master_admin
        SELECT id INTO rom_user_id FROM users
        ORDER BY created_at ASC
        LIMIT 1;

        IF rom_user_id IS NOT NULL THEN
            UPDATE users
            SET role = 'master_admin',
                partner_id = 'rom',
                updated_at = NOW()
            WHERE id = rom_user_id;

            RAISE NOTICE 'First user upgraded to master_admin: ID=%', rom_user_id;
        END IF;
    END IF;
END $$;

-- Comment the table
COMMENT ON TABLE users IS 'Users table with role-based access control (v007)';
COMMENT ON COLUMN users.role IS 'User role: user, admin, partner_admin, master_admin';
COMMENT ON COLUMN users.partner_id IS 'Partner ID for multi-tenant isolation (null for global users)';
COMMENT ON COLUMN users.name IS 'Full name of the user';
COMMENT ON COLUMN users.oab IS 'OAB registration number (Brazilian Bar Association)';
