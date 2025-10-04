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

export enum ApiKeyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REVOKED = 'revoked',
}

export enum ApiKeyType {
  USER = 'user',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  keyHash: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: ApiKeyType, default: ApiKeyType.USER })
  type: ApiKeyType;

  @Column({ type: 'enum', enum: ApiKeyStatus, default: ApiKeyStatus.ACTIVE })
  status: ApiKeyStatus;

  @Column()
  userId: string;

  @Column({ type: 'json', nullable: true })
  permissions: string[];

  @Column({ type: 'json', nullable: true })
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };

  @Column({ nullable: true })
  lastUsedAt: Date;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ type: 'bigint', default: 0 })
  usageCount: number;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => User, user => user.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
