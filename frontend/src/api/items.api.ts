import client from './client'
import type { Item } from '@/types/pos.types'
import type { PaginatedData } from '@/types/api.types'

export interface ItemPayload {
  name: string
  price: number
  category?: string
  sku?: string
  stock?: number
  isActive?: boolean
}

export const itemsApi = {
  list(params?: { page?: number; pageSize?: number; search?: string; category?: string }) {
    return client.get<PaginatedData<Item>>('/items', { params })
  },

  getById(id: string) {
    return client.get<Item>(`/items/${id}`)
  },

  create(payload: ItemPayload) {
    return client.post<Item>('/items', payload)
  },

  update(id: string, payload: Partial<ItemPayload>) {
    return client.patch<Item>(`/items/${id}`, payload)
  },

  delete(id: string) {
    return client.delete<void>(`/items/${id}`)
  },

  listCategories() {
    return client.get<string[]>('/items/categories')
  },
}
