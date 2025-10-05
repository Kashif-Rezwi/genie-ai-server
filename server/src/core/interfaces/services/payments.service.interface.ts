// Define interfaces locally to avoid circular dependencies
export interface CreatePaymentOrderDto {
  amount: number;
  currency?: string;
  packageId: string;
}

export interface VerifyPaymentDto {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface PaymentOrderResponse {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
}

export interface PaymentVerificationResponse {
  success: boolean;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  message: string;
}

export interface PaymentHistoryQueryDto {
  page?: number;
  limit?: number;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PaymentHistoryResponse {
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaymentAnalytics {
  totalPayments: number;
  successfulPayments: number;
  totalAmount: number;
  averageAmount: number;
  successRate: number;
  refunds: number;
  refundAmount: number;
}

/**
 * Interface for Payments Service
 * Defines the contract for payment processing operations
 */
export interface IPaymentsService {
  /**
   * Create a payment order
   * @param userId - The user's ID
   * @param createOrderDto - Payment order data
   * @returns Promise<PaymentOrderResponse> - Payment order details
   */
  createPaymentOrder(
    userId: string,
    createOrderDto: CreatePaymentOrderDto
  ): Promise<PaymentOrderResponse>;

  /**
   * Verify a payment
   * @param userId - The user's ID
   * @param verifyPaymentDto - Payment verification data
   * @returns Promise<PaymentVerificationResponse> - Verification result
   */
  verifyPayment(
    userId: string,
    verifyPaymentDto: VerifyPaymentDto
  ): Promise<PaymentVerificationResponse>;

  /**
   * Get payment history
   * @param userId - The user's ID
   * @param query - Query parameters
   * @returns Promise<PaymentHistoryResponse> - Payment history
   */
  getPaymentHistory(
    userId: string,
    query: PaymentHistoryQueryDto
  ): Promise<PaymentHistoryResponse>;

  /**
   * Get payment by ID
   * @param paymentId - The payment ID
   * @param userId - The user's ID
   * @returns Promise<Payment> - Payment details
   */
  getPaymentById(paymentId: string, userId: string): Promise<any>;

  /**
   * Refund a payment
   * @param paymentId - The payment ID
   * @param userId - The user's ID
   * @param refundAmount - Amount to refund (optional)
   * @param reason - Refund reason (optional)
   * @returns Promise<{ success: boolean; refundId?: string; message: string }>
   */
  refundPayment(
    paymentId: string,
    userId: string,
    refundAmount?: number,
    reason?: string
  ): Promise<{ success: boolean; refundId?: string; message: string }>;

  /**
   * Get payment analytics
   * @param userId - The user's ID
   * @param period - Time period for analytics
   * @returns Promise<PaymentAnalytics> - Payment analytics
   */
  getPaymentAnalytics(userId: string, period?: string): Promise<PaymentAnalytics>;

  /**
   * Get available payment packages
   * @returns Promise<Array> - Available packages
   */
  getAvailablePackages(): Promise<any[]>;
}
