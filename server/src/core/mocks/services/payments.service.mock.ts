import { 
  IPaymentsService,
  CreatePaymentOrderDto,
  VerifyPaymentDto,
  PaymentOrderResponse,
  PaymentVerificationResponse,
  PaymentHistoryQueryDto,
  PaymentHistoryResponse,
  PaymentAnalytics
} from '../../interfaces/services';

/**
 * Mock implementation of IPaymentsService for testing
 */
export class MockPaymentsService implements IPaymentsService {
  private mockPayments: any[] = [];
  private mockOrders: any[] = [];
  private nextId = 1;

  async createPaymentOrder(
    userId: string,
    createOrderDto: CreatePaymentOrderDto
  ): Promise<PaymentOrderResponse> {
    const order = {
      id: `order_${this.nextId++}`,
      userId,
      amount: createOrderDto.amount,
      currency: createOrderDto.currency || 'INR',
      packageId: createOrderDto.packageId,
      status: 'created',
      razorpayOrderId: `rzp_order_${Date.now()}`,
      createdAt: new Date(),
    };
    this.mockOrders.push(order);

    return {
      orderId: order.id,
      razorpayOrderId: order.razorpayOrderId,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
      createdAt: order.createdAt,
    };
  }

  async verifyPayment(
    userId: string,
    verifyPaymentDto: VerifyPaymentDto
  ): Promise<PaymentVerificationResponse> {
    const order = this.mockOrders.find(o => o.razorpayOrderId === verifyPaymentDto.razorpayOrderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const payment = {
      id: `payment_${this.nextId++}`,
      orderId: order.id,
      userId,
      amount: order.amount,
      currency: order.currency,
      status: 'captured',
      razorpayPaymentId: `rzp_payment_${Date.now()}`,
      razorpayOrderId: verifyPaymentDto.razorpayOrderId,
      createdAt: new Date(),
    };
    this.mockPayments.push(payment);

    return {
      success: true,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      message: 'Payment verified successfully',
    };
  }

  async getPaymentHistory(
    userId: string,
    query: PaymentHistoryQueryDto
  ): Promise<PaymentHistoryResponse> {
    const userPayments = this.mockPayments
      .filter(p => p.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = query.page ? (query.page - 1) * (query.limit || 10) : 0;
    const end = start + (query.limit || 10);
    const paginatedPayments = userPayments.slice(start, end);

    return {
      payments: paginatedPayments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        createdAt: payment.createdAt,
      })),
      pagination: {
        page: query.page || 1,
        limit: query.limit || 10,
        total: userPayments.length,
        totalPages: Math.ceil(userPayments.length / (query.limit || 10)),
      },
    };
  }

  async getPaymentById(paymentId: string, userId: string): Promise<any> {
    const payment = this.mockPayments.find(p => p.id === paymentId && p.userId === userId);
    if (!payment) {
      throw new Error('Payment not found');
    }
    return payment;
  }

  async refundPayment(
    paymentId: string,
    userId: string,
    refundAmount?: number,
    reason?: string
  ): Promise<{ success: boolean; refundId?: string; message: string }> {
    const payment = this.mockPayments.find(p => p.id === paymentId && p.userId === userId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status !== 'captured') {
      return {
        success: false,
        message: 'Payment cannot be refunded',
      };
    }

    const refundId = `refund_${Date.now()}`;
    payment.status = 'refunded';
    payment.refundAmount = refundAmount || payment.amount;
    payment.refundReason = reason;

    return {
      success: true,
      refundId,
      message: 'Refund processed successfully',
    };
  }

  async getPaymentAnalytics(userId: string, period?: string): Promise<PaymentAnalytics> {
    const userPayments = this.mockPayments.filter(p => p.userId === userId);
    const totalAmount = userPayments.reduce((sum, p) => sum + p.amount, 0);
    const successfulPayments = userPayments.filter(p => p.status === 'captured');

    return {
      totalPayments: userPayments.length,
      successfulPayments: successfulPayments.length,
      totalAmount,
      averageAmount: userPayments.length > 0 ? totalAmount / userPayments.length : 0,
      successRate: userPayments.length > 0 ? successfulPayments.length / userPayments.length : 0,
      refunds: userPayments.filter(p => p.status === 'refunded').length,
      refundAmount: userPayments
        .filter(p => p.status === 'refunded')
        .reduce((sum, p) => sum + (p.refundAmount || 0), 0),
    };
  }

  async getAvailablePackages(): Promise<any[]> {
    return [
      { id: 'basic', name: 'Basic Package', credits: 100, price: 9.99 },
      { id: 'premium', name: 'Premium Package', credits: 500, price: 39.99 },
      { id: 'pro', name: 'Pro Package', credits: 1000, price: 69.99 },
    ];
  }

  // Test helpers
  addMockPayment(payment: any): void {
    this.mockPayments.push(payment);
  }

  addMockOrder(order: any): void {
    this.mockOrders.push(order);
  }

  getMockPayments(): any[] {
    return [...this.mockPayments];
  }

  getMockOrders(): any[] {
    return [...this.mockOrders];
  }

  clearMockData(): void {
    this.mockPayments = [];
    this.mockOrders = [];
    this.nextId = 1;
  }
}
