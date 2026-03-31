import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';

export type BusinessType = 'retail' | 'restaurant' | 'school' | 'pharmacy' | 'service';
export type BusinessStatus = 'onboarding' | 'active' | 'suspended' | 'cancelled';
export type SubscriptionPlan = 'trial' | 'starter' | 'growth' | 'enterprise';

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

  @Column({ type: 'varchar', length: 20, default: 'trial' })
  subscriptionPlan: SubscriptionPlan;

  @Column({ type: 'varchar', length: 20, default: 'onboarding' })
  status: BusinessStatus;

  @Column({ nullable: true })
  ownerUserId: string;  // set after user is created in onboarding

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
