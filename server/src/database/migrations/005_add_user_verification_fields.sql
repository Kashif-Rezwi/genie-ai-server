-- Add email verification and password reset fields to users table
-- Migration: 005_add_user_verification_fields.sql

-- Add email verification fields
ALTER TABLE users 
ADD COLUMN is_email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN email_verification_token VARCHAR(255) NULL;

-- Add password reset fields
ALTER TABLE users 
ADD COLUMN reset_token VARCHAR(255) NULL,
ADD COLUMN reset_token_expiry TIMESTAMP NULL;

-- Create indexes for better performance
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX idx_users_reset_token ON users(reset_token);
CREATE INDEX idx_users_is_email_verified ON users(is_email_verified);

-- Add comments for documentation
COMMENT ON COLUMN users.is_email_verified IS 'Whether the user has verified their email address';
COMMENT ON COLUMN users.email_verification_token IS 'Token used for email verification';
COMMENT ON COLUMN users.reset_token IS 'Token used for password reset';
COMMENT ON COLUMN users.reset_token_expiry IS 'Expiration time for password reset token';
