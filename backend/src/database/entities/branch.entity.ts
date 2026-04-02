// ─── Branch ──────────────────────────────────────────────────────────────────
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Business } from './business.entity';

@Entity('branches')
export class Branch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'businessId' })
  business: Business;

  @Column()
  name: string;

  @Column({ nullable: true })
  address: string;

  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── UserBranch ───────────────────────────────────────────────────────────────
@Entity('user_branches')
export class UserBranch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  branchId: string;

  @CreateDateColumn()
  assignedAt: Date;
}

// ─── Role ─────────────────────────────────────────────────────────────────────
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  // System roles are seeded during provisioning and cannot be deleted
  @Column({ default: false })
  isSystemRole: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

// ─── Permission ───────────────────────────────────────────────────────────────
// Permissions are global (not per-business) — seeded once at app startup
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // e.g. 'inventory.adjust', 'pos.create', 'reports.view'
  @Column({ unique: true })
  code: string;

  // module grouping for UI display e.g. 'inventory', 'pos', 'reports'
  @Column()
  module: string;

  @Column({ nullable: true })
  description: string;
}

// ─── UserRole ─────────────────────────────────────────────────────────────────
@Entity('user_roles')
export class UserRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  roleId: string;

  // Role can be scoped to a specific branch, or null = all branches
  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @CreateDateColumn()
  assignedAt: Date;
}

// ─── RolePermission ───────────────────────────────────────────────────────────
@Entity('role_permissions')
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roleId: string;

  @Column()
  permissionId: string;
}
