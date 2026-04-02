import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Business } from './business.entity';

export type InviteStatus = 'pending' | 'active' | 'deactivated';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column({ unique: true })
  firebaseUid: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  displayName: string;

  // null = self-registered (owner). uuid = invited by another user
  @Column({ type: 'varchar', nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  inviteStatus: InviteStatus;

  @Column({ type: 'varchar', nullable: true })
  inviteToken: string | null;   // cleared once accepted

  @Column({ type: 'timestamptz', nullable: true })
  inviteExpiresAt: Date | null;

  @Column({ default: 'en' })
  preferredLanguage: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
