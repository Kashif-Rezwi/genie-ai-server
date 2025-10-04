-- Add additional performance indexes for better query performance
-- Migration: 006_add_additional_indexes.sql

-- Messages table additional indexes
CREATE INDEX IF NOT EXISTS idx_messages_chat_id_role ON messages(chat_id, role);
CREATE INDEX IF NOT EXISTS idx_messages_model ON messages(model);
CREATE INDEX IF NOT EXISTS idx_messages_credits_used ON messages(credits_used);

-- Users table additional indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_credits_balance ON users(credits_balance);

-- Credit transactions additional indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id_type ON credit_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_amount ON credit_transactions(amount);

-- Payments additional indexes
CREATE INDEX IF NOT EXISTS idx_payments_user_id_status ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_amount ON payments(amount);

-- API keys additional indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id_status ON api_keys(user_id, status);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON api_keys(created_at);

-- Credit audit logs additional indexes
CREATE INDEX IF NOT EXISTS idx_credit_audit_logs_user_id_action ON credit_audit_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_credit_audit_logs_created_at_action ON credit_audit_logs(created_at, action);
