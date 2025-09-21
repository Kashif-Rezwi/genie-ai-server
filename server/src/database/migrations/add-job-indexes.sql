-- Indexes for better job performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_chat_created 
ON messages("chatId", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_role_created 
ON messages(role, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_user_type_created 
ON credit_transactions("userId", type, "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chats_user_updated 
ON chats("userId", "updatedAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_created 
ON users("isActive", "createdAt" DESC);

-- Indexes for analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_created_date 
ON messages(DATE("createdAt"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_date 
ON users(DATE("createdAt"));

-- Note: Payment table indexes will be added when the payments table is created