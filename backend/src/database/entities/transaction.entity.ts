import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

// ─── Transaction ──────────────────────────────────────────────────────────────
export type TransactionType   = 'sale' | 'refund' | 'void';
export type TransactionStatus = 'open' | 'completed' | 'voided' | 'refunded';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  businessId: string;

  @Column()
  branchId: string;

  @Column()
  posTerminalId: string;

  // The customer / contact — optional
  @Column({ type: 'varchar', nullable: true })
  contactId: string | null;

  @Column()
  createdBy: string;   // userId of the cashier

  // Human-readable number e.g. TXN-20250101-0042
  @Column({ unique: true })
  transactionNumber: string;

  @Column({ type: 'varchar', length: 20, default: 'sale' })
  transactionType: TransactionType;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: TransactionStatus;

  // For restaurant — links to a table (nullable for retail / school)
  @Column({ type: 'varchar', nullable: true })
  tableId: string | null;

  // Order type: 'dine_in' | 'takeaway' | 'delivery' | null (retail)
  @Column({ type: 'varchar', nullable: true })
  orderType: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}

// ─── TransactionLine ──────────────────────────────────────────────────────────
@Entity('transaction_lines')
export class TransactionLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  transactionId: string;

  @Column()
  itemId: string;

  @Column({ type: 'varchar', nullable: true })
  variantId: string | null;

  // Snapshot fields — these preserve the values at time of sale.
  // Never JOIN back to items to reconstruct a receipt.
  @Column()
  itemNameSnapshot: string;

  @Column({ type: 'varchar', nullable: true })
  variantNameSnapshot: string | null;

  @Column({ type: 'varchar', nullable: true })
  skuSnapshot: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  lineTotal: number;    // (unitPrice × quantity) − discountAmount

  @CreateDateColumn()
  createdAt: Date;
}

// ─── Payment ──────────────────────────────────────────────────────────────────
export type PaymentMethod = 'cash' | 'card' | 'qr' | 'bank_transfer' | 'credit' | 'kpay' | 'other';
export type PaymentStatus  = 'pending' | 'completed' | 'failed' | 'refunded';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  transactionId: string;

  @Column({ type: 'varchar', length: 30 })
  paymentMethod: PaymentMethod;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  // For cash: amount tendered (to calculate change)
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  amountTendered: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  changeAmount: number | null;

  @Column({ type: 'varchar', length: 20, default: 'completed' })
  status: PaymentStatus;

  // External reference — card auth code, QR transaction ID, etc.
  @Column({ type: 'varchar', nullable: true })
  reference: string | null;

  @Column({ type: 'varchar', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  paidAt: Date;
}
