import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Business } from './business.entity';

export type ModuleStatus = 'active' | 'trial' | 'disabled';

@Entity('business_modules')
@Index(['businessId', 'moduleCode'], { unique: true })
export class BusinessModule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  moduleCode: string;

  @Column({ type: 'varchar', default: 'disabled' })
  status: ModuleStatus;

  @CreateDateColumn()
  enabledAt: Date;

  @Column({ nullable: true, type: 'timestamptz' })
  trialEndsAt: Date | null;
}
