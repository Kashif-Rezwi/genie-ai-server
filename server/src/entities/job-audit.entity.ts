import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('job_audits')
@Index(['jobId'], { unique: true })
@Index(['userId', 'createdAt'])
@Index(['status', 'createdAt'])
export class JobAudit {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    jobId: string;

    @Column({ nullable: true })
    userId?: string;

    @Column({ type: 'varchar', length: 50 })
    type: 'email' | 'ai' | 'payment' | 'analytics' | 'maintenance';

    @Column({ type: 'varchar', length: 20 })
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

    @Column({ type: 'jsonb' })
    data: any;

    @Column({ type: 'jsonb', nullable: true })
    result?: any;

    @Column({ type: 'text', nullable: true })
    error?: string;

    @Column({ type: 'int', default: 0 })
    attempts: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    completedAt?: Date;

    @Column({ type: 'timestamp', nullable: true })
    failedAt?: Date;
}
