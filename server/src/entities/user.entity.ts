import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    Index,
} from 'typeorm';
import { Chat } from './chat.entity';
import { CreditTransaction } from './credit-transaction.entity';

@Entity('users')
@Index(['email'])
@Index(['isActive'])
@Index(['isEmailVerified'])
@Index(['createdAt'])
@Index(['isActive', 'isEmailVerified'])
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column({ default: 0 })
    creditsBalance: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    creditsReserved: number;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: 'user' })
    role: string;

    @Column({ default: false })
    isEmailVerified: boolean;

    @Column({ nullable: true })
    emailVerificationToken: string | null;

    @Column({ nullable: true })
    resetToken: string | null;

    @Column({ nullable: true })
    resetTokenExpiry: Date | null;

    @OneToMany(() => Chat, chat => chat.user)
    chats: Chat[];

    @OneToMany(() => CreditTransaction, transaction => transaction.user)
    creditTransactions: CreditTransaction[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
