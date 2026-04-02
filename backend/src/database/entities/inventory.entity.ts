import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

// ─── Inventory ────────────────────────────────────────────────────────────────
@Entity('inventory')
export class Inventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  branchId: string;

  @Column()
  itemId: string;

  // null = base item (no variant)
  @Column({ type: 'varchar', nullable: true })
  variantId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  reservedQuantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 })
  reorderLevel: number;

  @UpdateDateColumn()
  lastMovementAt: Date;
}

// ─── InventoryMovement ────────────────────────────────────────────────────────
export type MovementType =
  | 'opening_stock'
  | 'purchase'
  | 'sale'
  | 'adjustment_in'
  | 'adjustment_out'
  | 'transfer_in'
  | 'transfer_out'
  | 'waste'
  | 'return_in'
  | 'issuance';

export type MovementDirection = 'in' | 'out';
export type MovementStatus    = 'pending' | 'approved' | 'rejected';

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @Column()
  branchId: string;

  @Column()
  itemId: string;

  @Column({ type: 'varchar', nullable: true })
  variantId: string | null;

  @Column({ type: 'varchar', length: 30 })
  movementType: MovementType;

  @Column({ type: 'varchar', length: 3 })
  direction: MovementDirection;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantityBefore: number;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantityAfter: number;

  @Column({ type: 'varchar', nullable: true })
  referenceType: string | null;

  @Column({ type: 'varchar', nullable: true })
  referenceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  transferPairId: string | null;

  @Column({ type: 'varchar', length: 20, default: 'approved' })
  status: MovementStatus;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;
}

// ─── InventoryAdjustment ──────────────────────────────────────────────────────
export type AdjustmentStatus = 'pending' | 'approved' | 'rejected';

@Entity('inventory_adjustments')
export class InventoryAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @Column()
  branchId: string;

  @Column()
  reasonCode: string;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: AdjustmentStatus;

  @Column()
  requestedBy: string;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string | null;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null;
}

// ─── InventoryTransfer ────────────────────────────────────────────────────────
export type TransferStatus = 'pending' | 'in_transit' | 'completed' | 'cancelled';

@Entity('inventory_transfers')
export class InventoryTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @Column()
  fromBranchId: string;

  @Column()
  toBranchId: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: TransferStatus;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
