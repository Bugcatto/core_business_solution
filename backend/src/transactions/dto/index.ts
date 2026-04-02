import { z } from 'zod';

export const CheckoutLineSchema = z.object({
  itemId:            z.string().uuid(),
  variantId:         z.string().uuid().optional(),
  quantity:          z.number().positive(),
  unitPriceOverride: z.number().min(0).optional(), // cashier manual override
  discountAmount:    z.number().min(0).default(0),
});
export type CheckoutLineDto = z.infer<typeof CheckoutLineSchema>;

export const CheckoutPaymentSchema = z.object({
  method:         z.enum(['cash', 'card', 'qr', 'bank_transfer', 'credit', 'kpay', 'other']),
  amount:         z.number().positive(),
  amountTendered: z.number().optional(), // cash only
  reference:      z.string().optional(), // card auth code, QR ref, etc.
});
export type CheckoutPaymentDto = z.infer<typeof CheckoutPaymentSchema>;

export const CheckoutSchema = z.object({
  posTerminalId:  z.string().uuid().optional(),
  contactId:      z.string().uuid().optional(),
  tableId:        z.string().uuid().optional(),   // restaurant only
  orderType:      z.enum(['dine_in', 'takeaway', 'delivery']).optional(),
  lines:          z.array(CheckoutLineSchema).min(1),
  payments:       z.array(CheckoutPaymentSchema).min(1),
  discountAmount: z.number().min(0).default(0),   // transaction-level discount
  taxRate:        z.number().min(0).max(100).default(0),
  notes:          z.string().optional(),
});
export type CheckoutDto = z.infer<typeof CheckoutSchema>;

export const TransactionQuerySchema = z.object({
  startDate:     z.string().optional(),  // ISO date
  endDate:       z.string().optional(),
  status:        z.enum(['open', 'completed', 'voided', 'refunded']).optional(),
  posTerminalId: z.string().uuid().optional(),
  contactId:     z.string().uuid().optional(),
  page:          z.coerce.number().int().min(1).default(1),
  limit:         z.coerce.number().int().min(1).max(100).default(20),
});
export type TransactionQueryDto = z.infer<typeof TransactionQuerySchema>;

export const VoidTransactionSchema = z.object({
  reason: z.string().min(1),
});
export type VoidTransactionDto = z.infer<typeof VoidTransactionSchema>;

export const RefundSchema = z.object({
  lines: z.array(z.object({
    transactionLineId: z.string().uuid(),
    quantity:          z.number().positive(),
  })).min(1),
  reason:          z.string().min(1),
  paymentMethod:   z.enum(['cash', 'card', 'qr', 'bank_transfer', 'other']).optional(),
});
export type RefundDto = z.infer<typeof RefundSchema>;
