import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Chat } from './chat.entity';
import { CreditTransaction } from './credit-transaction.entity';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column()
    password: string;

    @Column({ default: 0 })
    creditsBalance: number;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: 'user' })
    role: string;

    @OneToMany(() => Chat, chat => chat.user)
    chats: Chat[];

    @OneToMany(() => CreditTransaction, transaction => transaction.user)
    creditTransactions: CreditTransaction[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}