import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum TransactionType {
    PURCHASE = 'purchase',
    USAGE = 'usage',
    REFUND = 'refund',
}

@Entity('credit_transactions')
export class CreditTransaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'enum', enum: TransactionType })
    type: TransactionType;

    @Column({ type: 'decimal', precision: 10, scale: 4 })
    amount: number;

    @Column({ type: 'decimal', precision: 10, scale: 4 })
    balanceAfter: number;

    @Column({ nullable: true })
    description: string;

    @Column({ nullable: true })
    razorpayPaymentId: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata: Record<string, any>;

    @Column()
    userId: string;

    @ManyToOne(() => User, user => user.creditTransactions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @CreateDateColumn()
    createdAt: Date;
}
