-- Missing indexes for MVP performance
-- This migration adds only the indexes not covered by existing migrations

-- ===================================
-- USERS TABLE - MISSING INDEXES
-- ===================================

-- Email lookup (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON users(email);

-- User creation date for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at 
ON users("createdAt" DESC);

-- ===================================
-- CHATS TABLE - MISSING INDEXES
-- ===================================

-- User chats (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_user_id 
ON chats("userId");

-- Chat creation for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_created_at 
ON chats("createdAt" DESC);

-- ===================================
-- MESSAGES TABLE - MISSING INDEXES
-- ===================================

-- Chat messages (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_chat_id 
ON messages("chatId");

-- Message role queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_role 
ON messages(role);

-- Model usage analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_model 
ON messages(model) WHERE model IS NOT NULL;

-- Credits usage analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_credits_used 
ON messages("creditsUsed") WHERE "creditsUsed" > 0;

-- ===================================
-- CREDIT TRANSACTIONS - MISSING INDEXES
-- ===================================

-- User transactions with type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_user_type 
ON credit_transactions("userId", type);

-- User transactions with date ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_user_created 
ON credit_transactions("userId", "createdAt" DESC);

-- Transaction type analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_type 
ON credit_transactions(type);

-- Transaction date analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_created_at 
ON credit_transactions("createdAt" DESC);

-- Amount range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_amount 
ON credit_transactions(amount) WHERE amount > 0;

-- ===================================
-- CREDIT AUDIT LOG - MISSING INDEXES
-- ===================================

-- User audit logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_audit_logs_user_id 
ON credit_audit_logs("userId");

-- Audit logs with date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_audit_logs_user_created 
ON credit_audit_logs("userId", "createdAt" DESC);

-- Action type queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_audit_logs_action 
ON credit_audit_logs(action);

-- Transaction ID lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_audit_logs_transaction_id 
ON credit_audit_logs("transactionId") WHERE "transactionId" IS NOT NULL;

-- ===================================
-- PAYMENTS - MISSING INDEXES
-- ===================================

-- User payments with status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_status 
ON payments("userId", status);

-- User payments with date ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_created 
ON payments("userId", "createdAt" DESC);

-- Amount range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_amount 
ON payments(amount) WHERE amount > 0;

-- ===================================
-- ANALYTICS - MISSING INDEXES
-- ===================================

-- Daily transaction counts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_created_date 
ON credit_transactions(DATE("createdAt"));

-- Daily payment counts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_created_date 
ON payments(DATE("createdAt"));

-- ===================================
-- PERFORMANCE MONITORING
-- ===================================

-- Add table statistics update
ANALYZE users;
ANALYZE chats;
ANALYZE messages;
ANALYZE credit_transactions;
ANALYZE payments;
ANALYZE credit_audit_logs;
