-- Script: Upgrade user to master_admin role
-- Purpose: Grant master_admin privileges to the primary ROM user
-- Usage: Execute this script to grant full system access

-- Update the primary ROM user to master_admin
-- Replace the email below with your actual email if different
UPDATE users
SET role = 'master_admin',
    partner_id = 'rom',
    updated_at = NOW()
WHERE email = 'rodolfo@rom.adv.br';

-- Alternative: Update by username if you know it
-- UPDATE users
-- SET role = 'master_admin',
--     partner_id = 'rom',
--     updated_at = NOW()
-- WHERE username = 'your_username';

-- Verify the update
SELECT id, email, username, name, role, partner_id, created_at, updated_at
FROM users
WHERE role = 'master_admin';

-- Show current role distribution
SELECT role, COUNT(*) as count
FROM users
GROUP BY role
ORDER BY count DESC;
