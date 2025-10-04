import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToMany,
    CreateDateColumn,
    UpdateDateColumn,
    JoinColumn,
    Index,
} from 'typeorm';
import { User } from './user.entity';
import { Message } from './message.entity';

@Entity('chats')
@Index(['userId'])
@Index(['createdAt'])
@Index(['userId', 'createdAt'])
@Index(['title'])
export class Chat {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    title: string;

    @Column({ type: 'text', nullable: true })
    systemPrompt: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, user => user.chats, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @OneToMany(() => Message, message => message.chat)
    messages: Message[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
