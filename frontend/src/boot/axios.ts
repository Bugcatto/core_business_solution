import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import { useAuthStore } from '@/stores/auth.store'
import { useTenantStore } from '@/stores/tenant.store'
import type { ApiResponse } from '@/types/api.types'

const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ── Request interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Stores are only available after app is mounted — lazy-get them
    try {
      const authStore = useAuthStore()
      const tenantStore = useTenantStore()

      if (authStore.idToken) {
        config.headers.set('Authorization', `Bearer ${authStore.idToken}`)
      }

      if (tenantStore.businessId) {
        config.headers.set('X-Business-Id', tenantStore.businessId)
      }

      if (tenantStore.branchId) {
        config.headers.set('X-Branch-Id', tenantStore.branchId)
      }
    } catch {
      // Pinia not yet initialized (boot sequence); skip injection
    }

    return config
  },
  (error) => Promise.reject(error),
)

// ── Response interceptor ─────────────────────────────────────────────────────
let isRefreshing = false
let pendingQueue: Array<{
  resolve: (value: AxiosResponse) => void
  reject: (reason?: unknown) => void
  config: InternalAxiosRequestConfig
}> = []

apiClient.interceptors.response.use(
  // Unwrap response envelope: return response.data.data directly
  (response: AxiosResponse<ApiResponse>) => {
    if (
      response.data &&
      typeof response.data === 'object' &&
      'success' in response.data
    ) {
      response.data = response.data.data as never
    }
    return response
  },
  async (error) => {
    const originalConfig: InternalAxiosRequestConfig & { _retry?: boolean } =
      error.config

    if (error.response?.status === 401 && !originalConfig._retry) {
      if (isRefreshing) {
        // Queue requests while token is being refreshed
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject, config: originalConfig })
        })
      }

      originalConfig._retry = true
      isRefreshing = true

      try {
        const authStore = useAuthStore()
        await authStore.refreshToken()

        // Retry queued requests
        pendingQueue.forEach(({ resolve, config }) => {
          resolve(apiClient(config))
        })

        return apiClient(originalConfig)
      } catch (refreshError) {
        pendingQueue.forEach(({ reject }) => reject(refreshError))
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
        pendingQueue = []
      }
    }

    return Promise.reject(error)
  },
)

export default apiClient
