import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('credit_audit_logs')
@Index('idx_audit_user_date', ['userId', 'createdAt'])
@Index('idx_audit_action', ['action'])
export class CreditAuditLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column()
    action: string; // 'reserve', 'confirm', 'release', 'add', 'deduct'

    @Column('decimal', { precision: 10, scale: 2 })
    amount: number;

    @Column('decimal', { precision: 10, scale: 2 })
    balanceBefore: number;

    @Column('decimal', { precision: 10, scale: 2 })
    balanceAfter: number;

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    reservedBefore: number;

    @Column('decimal', { precision: 10, scale: 2, nullable: true })
    reservedAfter: number;

    @Column({ nullable: true })
    reservationId: string;

    @Column({ nullable: true })
    transactionId: string;

    @Column('jsonb')
    context: Record<string, any>;

    @CreateDateColumn()
    createdAt: Date;
}
