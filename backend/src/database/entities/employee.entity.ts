import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

// ─── Employee ─────────────────────────────────────────────────────────────────
export type EmploymentStatus = 'active' | 'on_leave' | 'terminated';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @Column()
  branchId: string;

  // Nullable — an employee doesn't require a system login account
  @Column({ nullable: true })
  userId: string | null;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true, nullable: true })
  employeeCode: string;

  @Column({ nullable: true })
  position: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: EmploymentStatus;

  @Column({ type: 'date', nullable: true })
  hireDate: string;

  @Column({ type: 'date', nullable: true })
  terminationDate: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── OnboardingProgress ───────────────────────────────────────────────────────
export type OnboardingStep =
  | 'signup'
  | 'business_created'
  | 'type_selected'
  | 'plan_selected'
  | 'provisioned'
  | 'wizard_complete'
  | 'live';

@Entity('onboarding_progress')
export class OnboardingProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  businessId: string;

  @Column({
    type: 'enum',
    enum: ['signup','business_created','type_selected','plan_selected',
           'provisioned','wizard_complete','live'],
    default: 'signup',
  })
  currentStep: OnboardingStep;

  // Wizard checklist flags
  @Column({ default: false }) hasAddedItems: boolean;
  @Column({ default: false }) hasAddedStaff: boolean;
  @Column({ default: false }) hasConfiguredReceipt: boolean;
  @Column({ default: false }) hasSetBranchDetails: boolean;
  @Column({ default: false }) hasAddedOpeningStock: boolean;
  @Column({ default: false }) hasTestedTransaction: boolean;

  // Stores partial form data if user drops off mid-wizard
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── Setting ──────────────────────────────────────────────────────────────────
// Key-value store per business (and optionally per branch)
@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  // null = business-wide, uuid = branch-specific override
  @Column({ nullable: true })
  branchId: string | null;

  @Column()
  key: string;   // e.g. 'receipt.footer', 'pos.allow_discount', 'tax.rate'

  @Column({ type: 'text' })
  value: string; // always stored as string; caller casts as needed

  @UpdateDateColumn()
  updatedAt: Date;
}
