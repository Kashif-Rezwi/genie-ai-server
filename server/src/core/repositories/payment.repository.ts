import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, PaymentMethod } from '../../entities';
import { IPaymentRepository } from './interfaces/payment.repository.interface';

@Injectable()
export class PaymentRepository implements IPaymentRepository {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>
  ) {}

  async findById(id: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({ where: { id } });
  }

  async findByUserId(userId: string, skip = 0, take = 100): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { userId },
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(skip = 0, take = 100): Promise<Payment[]> {
    return this.paymentRepository.find({
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
  }

  async create(paymentData: Partial<Payment>): Promise<Payment> {
    const payment = this.paymentRepository.create(paymentData);
    return this.paymentRepository.save(payment);
  }

  async update(id: string, paymentData: Partial<Payment>): Promise<Payment> {
    await this.paymentRepository.update(id, paymentData);
    const updatedPayment = await this.findById(id);
    if (!updatedPayment) {
      throw new Error(`Payment with ID ${id} not found after update`);
    }
    return updatedPayment;
  }

  async delete(id: string): Promise<void> {
    await this.paymentRepository.delete(id);
  }

  async findByStatus(status: PaymentStatus): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { status },
      order: { createdAt: 'DESC' },
    });
  }

  async findByMethod(method: PaymentMethod): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { method },
      order: { createdAt: 'DESC' },
    });
  }

  async findByDateRange(userId: string, startDate: Date, endDate: Date): Promise<Payment[]> {
    return this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.userId = :userId', { userId })
      .andWhere('payment.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('payment.createdAt', 'DESC')
      .getMany();
  }

  async countByUserId(userId: string): Promise<number> {
    return this.paymentRepository.count({ where: { userId } });
  }

  async getTotalAmountByUserId(userId: string): Promise<number> {
    const result = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(payment.amount)', 'total')
      .where('payment.userId = :userId', { userId })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .getRawOne();

    return parseFloat(result.total) || 0;
  }

  async findByRazorpayOrderId(orderId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({ where: { razorpayOrderId: orderId } });
  }

  async findByRazorpayPaymentId(paymentId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({ where: { razorpayPaymentId: paymentId } });
  }

  async findRecentByUserId(userId: string, limit = 20): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { userId },
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async find(conditions: any): Promise<Payment[]> {
    return this.paymentRepository.find(conditions);
  }

  async findOne(conditions: any): Promise<Payment | null> {
    return this.paymentRepository.findOne(conditions);
  }

  async save(payment: Payment): Promise<Payment> {
    return this.paymentRepository.save(payment);
  }
}
