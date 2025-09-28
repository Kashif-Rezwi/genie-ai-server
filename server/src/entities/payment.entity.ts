import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum PaymentStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    FAILED = 'failed',
    REFUNDED = 'refunded',
    CANCELLED = 'cancelled',
}

export enum PaymentMethod {
    RAZORPAY = 'razorpay',
    BANK_TRANSFER = 'bank_transfer',
    ADMIN_CREDIT = 'admin_credit',
}

@Entity('payments')
export class Payment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column({ unique: true })
    razorpayOrderId: string;

    @Column({ nullable: true })
    razorpayPaymentId: string;

    @Column({ nullable: true })
    razorpaySignature: string;

    @Column()
    packageId: string;

    @Column()
    packageName: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column()
    currency: string;

    @Column({ type: 'decimal', precision: 10, scale: 0 })
    creditsAmount: number;

    @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
    status: PaymentStatus;

    @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.RAZORPAY })
    method: PaymentMethod;

    @Column({ type: 'json', nullable: true })
    metadata: Record<string, any>;

    @Column({ nullable: true })
    failureReason: string;

    @Column({ nullable: true })
    creditTransactionId: string;

    @ManyToOne(() => User, user => user.id, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
