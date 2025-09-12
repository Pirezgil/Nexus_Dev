-- Create test user for notification testing
INSERT INTO nexus_auth.users (
    id, 
    email, 
    password_hash, 
    first_name, 
    last_name, 
    role, 
    status, 
    created_at, 
    updated_at
) VALUES (
    gen_random_uuid(), 
    'admin@exemplo.com', 
    '$2b$10$K8.Y8QzqVYcY3K8Yqz8YqO8YqO8YqO8YqO8YqO8YqO8YqO8YqO8Y', 
    'Admin', 
    'Test', 
    'ADMIN', 
    'ACTIVE', 
    NOW(), 
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Check if user was created
SELECT id, email, first_name, last_name, role, status FROM nexus_auth.users WHERE email = 'admin@exemplo.com';