export interface ApiResponse<T = unknown> {
  success: boolean
  data: T
  timestamp: string
}

export interface PaginatedData<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ApiError {
  message: string
  code?: string
  statusCode?: number
}
