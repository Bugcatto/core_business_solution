import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Business } from './business.entity';

// ─── Category ─────────────────────────────────────────────────────────────────
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  // Supports one level of nesting (parent → child). null = root category.
  @Column({ type: 'varchar', nullable: true })
  parentId: string | null;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

// ─── Item ──────────────────────────────────────────────────────────────────────
export type ItemType =
  | 'product'    // physical goods — tracked in inventory
  | 'service'    // service — not tracked
  | 'bundle'     // composite of other items (Phase 4)
  | 'fee';       // school / service fee — not tracked

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @Column({ type: 'varchar', nullable: true })
  categoryId: string | null;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'varchar', nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', nullable: true })
  barcode: string | null;

  @Column({ type: 'varchar', length: 20, default: 'product' })
  itemType: ItemType;

  // Base price — can be overridden per variant
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price: number;

  @Column({ default: 'pcs' })
  unit: string;   // e.g. 'pcs', 'kg', 'bottle', 'box'

  // Whether this item deducts from inventory on sale
  @Column({ default: true })
  trackInventory: boolean;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// ─── ItemVariant ──────────────────────────────────────────────────────────────
// e.g. Size: S / M / L  or  Color: Red / Blue
// Each variant has its own SKU, barcode, and optional price override.
@Entity('item_variants')
export class ItemVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  itemId: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'itemId' })
  item: Item;

  @Column()
  name: string;   // e.g. 'Large / Red'

  @Column({ type: 'varchar', nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', nullable: true })
  barcode: string | null;

  // null = inherit from parent item
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  priceOverride: number | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

// ─── PosTerminal ──────────────────────────────────────────────────────────────
@Entity('pos_terminals')
export class PosTerminal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'business_id' })
  businessId: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column()
  branchId: string;

  @Column()
  name: string;   // e.g. 'Counter 1', 'Mobile POS'

  // 'web' | 'tablet' | 'mobile' — informational only
  @Column({ default: 'web' })
  deviceType: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
