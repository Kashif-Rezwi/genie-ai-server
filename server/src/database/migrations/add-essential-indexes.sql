-- Essential indexes for credit system
-- Only the indexes we actually need based on real queries

-- Index for getting transactions by user (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_user_id 
ON credit_transactions("userId");

-- Index for payment ID lookups (idempotency checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_credit_transactions_payment_id 
ON credit_transactions("razorpayPaymentId") WHERE "razorpayPaymentId" IS NOT NULL;

-- Index for user balance queries (if we need to query by balance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_credits_balance 
ON users("creditsBalance") WHERE "creditsBalance" > 0;
