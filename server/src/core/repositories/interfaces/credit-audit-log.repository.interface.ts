import { CreditAuditLog } from '../../../entities';

export interface ICreditAuditLogRepository {
  /**
   * Find an audit log by ID
   */
  findById(id: string): Promise<CreditAuditLog | null>;

  /**
   * Find audit logs by user ID
   */
  findByUserId(userId: string, skip?: number, take?: number): Promise<CreditAuditLog[]>;

  /**
   * Find all audit logs with pagination
   */
  findAll(skip?: number, take?: number): Promise<CreditAuditLog[]>;

  /**
   * Create a new audit log
   */
  create(auditLogData: Partial<CreditAuditLog>): Promise<CreditAuditLog>;

  /**
   * Update an audit log
   */
  update(id: string, auditLogData: Partial<CreditAuditLog>): Promise<CreditAuditLog>;

  /**
   * Delete an audit log
   */
  delete(id: string): Promise<void>;

  /**
   * Find audit logs by action
   */
  findByAction(action: string): Promise<CreditAuditLog[]>;

  /**
   * Find audit logs by date range
   */
  findByDateRange(userId: string, startDate: Date, endDate: Date): Promise<CreditAuditLog[]>;

  /**
   * Count audit logs by user
   */
  countByUserId(userId: string): Promise<number>;

  /**
   * Find recent audit logs
   */
  findRecentByUserId(userId: string, limit?: number): Promise<CreditAuditLog[]>;

  /**
   * Find audit logs by transaction ID
   */
  findByTransactionId(transactionId: string): Promise<CreditAuditLog[]>;
}
