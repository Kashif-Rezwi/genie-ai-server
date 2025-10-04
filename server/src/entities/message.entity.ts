import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    JoinColumn,
    Index,
} from 'typeorm';
import { Chat } from './chat.entity';

export enum MessageRole {
    USER = 'user',
    ASSISTANT = 'assistant',
    SYSTEM = 'system',
}

@Entity('messages')
@Index(['chatId'])
@Index(['createdAt'])
@Index(['chatId', 'createdAt'])
@Index(['role'])
@Index(['model'])
@Index(['chatId', 'role', 'createdAt'])
export class Message {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'enum', enum: MessageRole })
    role: MessageRole;

    @Column({ type: 'text' })
    content: string;

    @Column({ nullable: true })
    model: string;

    @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
    creditsUsed: number;

    @Column()
    chatId: string;

    @ManyToOne(() => Chat, chat => chat.messages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'chatId' })
    chat: Chat;

    @CreateDateColumn()
    createdAt: Date;
}
