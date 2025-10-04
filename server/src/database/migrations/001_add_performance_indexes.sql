-- Performance indexes for Genie AI Server
-- This migration adds indexes to improve query performance for common operations

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(is_email_verified);

-- Chats table indexes
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON chats(created_at);
CREATE INDEX IF NOT EXISTS idx_chats_user_created ON chats(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_title ON chats(title);

-- Messages table indexes
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_model ON messages(model);

-- Credit transactions table indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_razorpay_payment_id ON credit_transactions(razorpay_payment_id);

-- Credit audit logs table indexes
CREATE INDEX IF NOT EXISTS idx_credit_audit_logs_user_id ON credit_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_audit_logs_created_at ON credit_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_audit_logs_action ON credit_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_credit_audit_logs_user_created ON credit_audit_logs(user_id, created_at DESC);

-- API keys table indexes (if exists)
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON api_keys(created_at);

-- Payments table indexes (if exists)
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_created ON payments(user_id, created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_users_active_verified ON users(is_active, is_email_verified) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_messages_chat_role_created ON messages(chat_id, role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_type_created ON credit_transactions(user_id, type, created_at DESC);

-- Partial indexes for better performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_purchases ON credit_transactions(user_id, created_at DESC) WHERE type = 'purchase';
CREATE INDEX IF NOT EXISTS idx_credit_transactions_usage ON credit_transactions(user_id, created_at DESC) WHERE type = 'usage';
CREATE INDEX IF NOT EXISTS idx_messages_user_messages ON messages(chat_id, created_at DESC) WHERE role = 'user';
CREATE INDEX IF NOT EXISTS idx_messages_assistant_messages ON messages(chat_id, created_at DESC) WHERE role = 'assistant';

-- Text search indexes (if using full-text search)
CREATE INDEX IF NOT EXISTS idx_messages_content_gin ON messages USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_chats_title_gin ON chats USING gin(to_tsvector('english', title));

-- Statistics update to help query planner
ANALYZE users;
ANALYZE chats;
ANALYZE messages;
ANALYZE credit_transactions;
ANALYZE credit_audit_logs;
