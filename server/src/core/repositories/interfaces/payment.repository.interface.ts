import { Payment, PaymentStatus, PaymentMethod } from '../../../entities';

export interface IPaymentRepository {
  /**
   * Find a payment by ID
   */
  findById(id: string): Promise<Payment | null>;

  /**
   * Find payments by user ID
   */
  findByUserId(userId: string, skip?: number, take?: number): Promise<Payment[]>;

  /**
   * Find all payments with pagination
   */
  findAll(skip?: number, take?: number): Promise<Payment[]>;

  /**
   * Create a new payment
   */
  create(paymentData: Partial<Payment>): Promise<Payment>;

  /**
   * Update a payment
   */
  update(id: string, paymentData: Partial<Payment>): Promise<Payment>;

  /**
   * Delete a payment
   */
  delete(id: string): Promise<void>;

  /**
   * Find payments by status
   */
  findByStatus(status: PaymentStatus): Promise<Payment[]>;

  /**
   * Find payments by method
   */
  findByMethod(method: PaymentMethod): Promise<Payment[]>;

  /**
   * Find payments by date range
   */
  findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Payment[]>;

  /**
   * Count payments by user
   */
  countByUserId(userId: string): Promise<number>;

  /**
   * Get total amount by user
   */
  getTotalAmountByUserId(userId: string): Promise<number>;

  /**
   * Find payments by Razorpay order ID
   */
  findByRazorpayOrderId(orderId: string): Promise<Payment | null>;

  /**
   * Find payments by Razorpay payment ID
   */
  findByRazorpayPaymentId(paymentId: string): Promise<Payment | null>;

  /**
   * Find recent payments
   */
  findRecentByUserId(userId: string, limit?: number): Promise<Payment[]>;

  /**
   * Find payments with conditions
   */
  find(conditions: any): Promise<Payment[]>;

  /**
   * Find one payment with conditions
   */
  findOne(conditions: any): Promise<Payment | null>;

  /**
   * Save a payment
   */
  save(payment: Payment): Promise<Payment>;
}
