-- Essential indexes for payment system performance
-- These indexes are critical for production performance

-- Index for user payment queries (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_id 
ON payments("userId");

-- Index for payment status queries (admin dashboards, analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_status 
ON payments(status);

-- Index for payment date queries (analytics, reporting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_created_at 
ON payments("createdAt" DESC);

-- Index for Razorpay order ID lookups (webhook processing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_razorpay_order_id 
ON payments("razorpayOrderId");

-- Index for Razorpay payment ID lookups (refunds, verification)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_razorpay_payment_id 
ON payments("razorpayPaymentId") WHERE "razorpayPaymentId" IS NOT NULL;

-- Composite index for user payment history with status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_user_status_created 
ON payments("userId", status, "createdAt" DESC);

-- Index for package analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_package_id 
ON payments("packageId") WHERE status = 'completed';

-- Index for refund queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_refunded 
ON payments("createdAt" DESC) WHERE status = 'refunded';
