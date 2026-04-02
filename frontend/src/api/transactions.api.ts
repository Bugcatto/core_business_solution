import client from './client'
import type { Transaction, CheckoutPayload } from '@/types/pos.types'
import type { PaginatedData } from '@/types/api.types'

export const transactionsApi = {
  checkout(payload: CheckoutPayload) {
    return client.post<Transaction>('/transactions/checkout', payload)
  },

  list(params?: { page?: number; pageSize?: number; from?: string; to?: string }) {
    return client.get<PaginatedData<Transaction>>('/transactions', { params })
  },

  getById(id: string) {
    return client.get<Transaction>(`/transactions/${id}`)
  },

  void(id: string, reason: string) {
    return client.post<Transaction>(`/transactions/${id}/void`, { reason })
  },

  refund(id: string, reason: string) {
    return client.post<Transaction>(`/transactions/${id}/refund`, { reason })
  },
}
