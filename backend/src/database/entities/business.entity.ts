import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';

export type BusinessType = 'retail' | 'restaurant' | 'school' | 'pharmacy' | 'service';
export type BusinessStatus = 'draft' | 'onboarding' | 'active' | 'paused' | 'suspended' | 'archived' | 'closed';
export type SubscriptionPlan = 'free' | 'starter' | 'growth' | 'enterprise';

@Entity('businesses')
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 20 })
  businessType: BusinessType;

  @Column({ type: 'varchar', length: 20, default: 'free' })
  subscriptionPlan: SubscriptionPlan;

  @Column({ type: 'varchar', length: 20, default: 'onboarding' })
  status: BusinessStatus;

  // FK to platform_owners — the account that owns this business
  @Column({ nullable: true })
  platformOwnerId: string;

  @Column({ nullable: true })
  ownerUserId: string;  // FK to users — the staff record with Owner role in this business

  @Column({ default: 'en' })
  defaultLanguage: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  currency: string;  // ISO 4217 e.g. 'USD', 'MMK'

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  logoUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
