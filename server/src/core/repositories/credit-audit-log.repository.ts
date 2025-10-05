import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditAuditLog } from '../../entities';
import { ICreditAuditLogRepository } from './interfaces/credit-audit-log.repository.interface';

@Injectable()
export class CreditAuditLogRepository implements ICreditAuditLogRepository {
  constructor(
    @InjectRepository(CreditAuditLog)
    private readonly auditLogRepository: Repository<CreditAuditLog>
  ) {}

  async findById(id: string): Promise<CreditAuditLog | null> {
    return this.auditLogRepository.findOne({ where: { id } });
  }

  async findByUserId(userId: string, skip = 0, take = 100): Promise<CreditAuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(skip = 0, take = 100): Promise<CreditAuditLog[]> {
    return this.auditLogRepository.find({
      skip,
      take,
      order: { createdAt: 'DESC' },
    });
  }

  async create(auditLogData: Partial<CreditAuditLog>): Promise<CreditAuditLog> {
    const auditLog = this.auditLogRepository.create(auditLogData);
    return this.auditLogRepository.save(auditLog);
  }

  async update(id: string, auditLogData: Partial<CreditAuditLog>): Promise<CreditAuditLog> {
    await this.auditLogRepository.update(id, auditLogData);
    const updatedAuditLog = await this.findById(id);
    if (!updatedAuditLog) {
      throw new Error(`CreditAuditLog with ID ${id} not found after update`);
    }
    return updatedAuditLog;
  }

  async delete(id: string): Promise<void> {
    await this.auditLogRepository.delete(id);
  }

  async findByAction(action: string): Promise<CreditAuditLog[]> {
    return this.auditLogRepository.find({
      where: { action },
      order: { createdAt: 'DESC' },
    });
  }

  async findByDateRange(userId: string, startDate: Date, endDate: Date): Promise<CreditAuditLog[]> {
    return this.auditLogRepository
      .createQueryBuilder('auditLog')
      .where('auditLog.userId = :userId', { userId })
      .andWhere('auditLog.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('auditLog.createdAt', 'DESC')
      .getMany();
  }

  async countByUserId(userId: string): Promise<number> {
    return this.auditLogRepository.count({ where: { userId } });
  }

  async findRecentByUserId(userId: string, limit = 20): Promise<CreditAuditLog[]> {
    return this.auditLogRepository.find({
      where: { userId },
      take: limit,
      order: { createdAt: 'DESC' },
    });
  }

  async findByTransactionId(transactionId: string): Promise<CreditAuditLog[]> {
    return this.auditLogRepository.find({
      where: { transactionId },
      order: { createdAt: 'DESC' },
    });
  }
}
