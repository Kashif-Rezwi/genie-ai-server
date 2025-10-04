import { IsString, IsNumber, IsOptional, IsEnum, IsUUID, Min, Max } from 'class-validator';
import { PaymentMethod } from '../../../entities/payment.entity';

export class CreatePaymentOrderDto {
  @IsString()
  packageId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class VerifyPaymentDto {
  @IsString()
  razorpayOrderId: string;

  @IsString()
  razorpayPaymentId: string;

  @IsString()
  razorpaySignature: string;
}

export class PaymentHistoryQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsEnum(['pending', 'completed', 'failed', 'refunded', 'cancelled'])
  status?: string;

  @IsOptional()
  startDate?: Date;

  @IsOptional()
  endDate?: Date;
}

export class RefundPaymentDto {
  @IsString()
  paymentId: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export interface PaymentOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  packageDetails: {
    id: string;
    name: string;
    credits: number;
    bonusCredits: number;
    totalCredits: number;
  };
  razorpayKeyId: string;
  user: {
    id: string;
    email: string;
  };
}

export interface PaymentVerificationResponse {
  success: boolean;
  payment: {
    id: string;
    orderId: string;
    paymentId: string;
    status: string;
    amount: number;
    creditsAdded: number;
    newBalance: number;
  };
}

export interface PaymentHistoryResponse {
  payments: Array<{
    id: string;
    packageId: string;
    packageName: string;
    amount: number;
    currency: string;
    creditsAmount: number;
    status: string;
    method: string;
    createdAt: Date;
    completedAt?: Date;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
