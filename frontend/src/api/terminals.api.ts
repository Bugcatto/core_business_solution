import client from './client'
import type { Terminal } from '@/types/tenant.types'

export const terminalsApi = {
  list(branchId: string) {
    return client.get<Terminal[]>('/terminals', { params: { branchId } })
  },

  getById(id: string) {
    return client.get<Terminal>(`/terminals/${id}`)
  },

  create(payload: { branchId: string; name: string }) {
    return client.post<Terminal>('/terminals', payload)
  },

  openShift(terminalId: string) {
    return client.post<void>(`/terminals/${terminalId}/shift/open`)
  },

  closeShift(terminalId: string) {
    return client.post<void>(`/terminals/${terminalId}/shift/close`)
  },
}
