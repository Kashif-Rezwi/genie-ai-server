import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditTransaction, TransactionType } from '../../entities';
import { ICreditTransactionRepository } from './interfaces/credit-transaction.repository.interface';

@Injectable()
export class CreditTransactionRepository implements ICreditTransactionRepository {
  constructor(
    @InjectRepository(CreditTransaction)
    private readonly transactionRepository: Repository<CreditTransaction>,
  ) {}

  async findById(id: string): Promise<CreditTransaction | null> {
    return this.transactionRepository.findOne({ where: { id } });
  }

  async findByUserId(userId: string, skip = 0, take = 100): Promise<CreditTransaction[]> {
    return this.transactionRepository.find({
      where: { userId },
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(skip = 0, take = 100): Promise<CreditTransaction[]> {
    return this.transactionRepository.find({
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
  }

  async create(transactionData: Partial<CreditTransaction>): Promise<CreditTransaction> {
    const transaction = this.transactionRepository.create(transactionData);
    return this.transactionRepository.save(transaction);
  }

  async update(id: string, transactionData: Partial<CreditTransaction>): Promise<CreditTransaction> {
    await this.transactionRepository.update(id, transactionData);
    const updatedTransaction = await this.findById(id);
    if (!updatedTransaction) {
      throw new Error(`CreditTransaction with ID ${id} not found after update`);
    }
    return updatedTransaction;
  }

  async delete(id: string): Promise<void> {
    await this.transactionRepository.delete(id);
  }

  async findByType(userId: string, type: TransactionType): Promise<CreditTransaction[]> {
    return this.transactionRepository.find({
      where: { userId, type },
      order: { createdAt: 'DESC' },
    });
  }

  async findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CreditTransaction[]> {
    return this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('transaction.createdAt', 'DESC')
      .getMany();
  }

  async countByUserId(userId: string): Promise<number> {
    return this.transactionRepository.count({ where: { userId } });
  }

  async getTotalCreditsAdded(userId: string): Promise<number> {
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.type = :type', { type: TransactionType.PURCHASE })
      .getRawOne();
    
    return parseFloat(result.total) || 0;
  }

  async getTotalCreditsDeducted(userId: string): Promise<number> {
    const result = await this.transactionRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.type = :type', { type: TransactionType.USAGE })
      .getRawOne();
    
    return parseFloat(result.total) || 0;
  }

  async findRecentByUserId(userId: string, limit = 20): Promise<CreditTransaction[]> {
    return this.transactionRepository.find({
      where: { userId },
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async find(conditions: any): Promise<CreditTransaction[]> {
    return this.transactionRepository.find(conditions);
  }

  async findOne(conditions: any): Promise<CreditTransaction | null> {
    return this.transactionRepository.findOne(conditions);
  }

  async count(): Promise<number> {
    return this.transactionRepository.count();
  }
}
