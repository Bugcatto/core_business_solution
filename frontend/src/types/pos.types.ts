export interface Item {
  id: string
  name: string
  price: number
  category?: string
  sku?: string
  imageUrl?: string
  stock?: number
  isActive: boolean
}

export interface CartItem {
  itemId: string
  name: string
  price: number
  quantity: number
  variantId?: string
  variantName?: string
}

export type PaymentMethod = 'cash' | 'card' | 'kpay' | 'qr'

export interface PaymentDetail {
  method: PaymentMethod
  amount: number
  reference?: string
}

export interface CheckoutPayload {
  branchId: string
  terminalId?: string
  items: Array<{
    itemId: string
    name: string
    quantity: number
    unitPrice: number
    variantId?: string
  }>
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  payment: PaymentDetail
  tableNumber?: string
  prescriptionRef?: string
  studentId?: string
  notes?: string
}

export interface Transaction {
  id: string
  transactionNumber: string
  branchId: string
  terminalId?: string
  items: Array<{
    itemId: string
    name: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  payment: PaymentDetail
  status: 'completed' | 'refunded' | 'voided'
  createdAt: string
  cashierName?: string
}

export interface PendingTransaction {
  localId: string
  payload: CheckoutPayload
  createdAt: string
  retryCount: number
}
