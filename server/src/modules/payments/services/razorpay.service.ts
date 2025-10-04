import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
const Razorpay = require('razorpay');
import * as crypto from 'crypto';
import { paymentConfig } from '../../../config';

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: number;
}

export interface RazorpayPaymentVerification {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  private readonly config = paymentConfig();
  private razorpay: InstanceType<typeof Razorpay>;

  constructor() {
    if (
      !this.config.razorpay.keyId ||
      !this.config.razorpay.keySecret ||
      !this.config.razorpay.webhookSecret
    ) {
      throw new Error('Razorpay credentials not configured');
    }

    this.razorpay = new Razorpay({
      key_id: this.config.razorpay.keyId,
      key_secret: this.config.razorpay.keySecret,
      webhook_secret: this.config.razorpay.webhookSecret,
    });
  }

  async createOrder(
    amount: number,
    currency: string = 'INR',
    receipt: string,
    notes: Record<string, any> = {}
  ): Promise<RazorpayOrder> {
    try {
      const options = {
        amount: Math.round(amount * 100), // Razorpay expects amount in paise
        currency,
        receipt,
        notes,
      };

      const order = await this.razorpay.orders.create(options);
      return order as RazorpayOrder;
    } catch (error) {
      this.logger.error('Razorpay order creation failed:', error);
      throw new InternalServerErrorException('Failed to create payment order');
    }
  }

  async fetchOrder(orderId: string): Promise<any> {
    try {
      return (await this.razorpay.orders.fetch(orderId)) as RazorpayOrder;
    } catch (error) {
      this.logger.error('Failed to fetch Razorpay order:', error);
      throw new BadRequestException('Invalid order ID');
    }
  }

  async fetchPayment(paymentId: string): Promise<any> {
    try {
      return await this.razorpay.payments.fetch(paymentId);
    } catch (error) {
      this.logger.error('Failed to fetch Razorpay payment:', error);
      throw new BadRequestException('Invalid payment ID');
    }
  }

  verifyPaymentSignature(verification: RazorpayPaymentVerification): boolean {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verification;

      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', this.config.razorpay.keySecret!)
        .update(body.toString())
        .digest('hex');

      return expectedSignature === razorpay_signature;
    } catch (error) {
      this.logger.error('Payment signature verification failed:', error);
      return false;
    }
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.config.razorpay.webhookSecret!)
        .update(body)
        .digest('hex');

      return expectedSignature === signature;
    } catch (error) {
      this.logger.error('Webhook signature verification failed:', error);
      return false;
    }
  }

  async refundPayment(
    paymentId: string,
    amount?: number,
    notes: Record<string, any> = {}
  ): Promise<any> {
    try {
      const refundData: any = { notes };
      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to paise
      }

      return await this.razorpay.payments.refund(paymentId, refundData);
    } catch (error) {
      this.logger.error('Razorpay refund failed:', error);
      throw new InternalServerErrorException('Failed to process refund');
    }
  }

  async getPaymentMethods(): Promise<any> {
    try {
      // Razorpay doesn't provide a direct API to fetch payment methods
      // return await this.razorpay.methods.all();

      // Return the standard supported methods
      return {
        cards: true,
        netbanking: true,
        wallet: true,
        upi: true,
        emi: true,
        paylater: true,
      };
    } catch (error) {
      this.logger.error('Failed to fetch payment methods:', error);
      return { cards: true, netbanking: true, wallet: true, upi: true };
    }
  }

  // Helper method to convert amount from paise to rupees
  paiseToRupees(paise: number): number {
    return paise / 100;
  }

  // Helper method to convert amount from rupees to paise
  rupeesToPaise(rupees: number): number {
    return Math.round(rupees * 100);
  }
}
