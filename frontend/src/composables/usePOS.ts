import { ref } from 'vue'
import { usePOSStore } from '@/stores/pos.store'
import { useTenantStore } from '@/stores/tenant.store'
import { useAuthStore } from '@/stores/auth.store'
import { transactionsApi } from '@/api/transactions.api'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import type { CartItem, CheckoutPayload, PaymentDetail, PendingTransaction, Transaction } from '@/types/pos.types'

export function usePOS() {
  const posStore = usePOSStore()
  const tenantStore = useTenantStore()
  const authStore = useAuthStore()
  const $q = useQuasar()
  const { t } = useI18n()

  const isProcessing = ref(false)
  const lastTransaction = ref<Transaction | null>(null)

  async function checkout(payment: PaymentDetail): Promise<Transaction | null> {
    if (posStore.cart.length === 0) return null

    isProcessing.value = true

    const payload: CheckoutPayload = {
      branchId: tenantStore.branchId!,
      terminalId: tenantStore.terminalId ?? undefined,
      items: posStore.cart.map((item: CartItem) => ({
        itemId: item.itemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        variantId: item.variantId,
      })),
      subtotal: posStore.subtotal,
      discountAmount: posStore.discountAmount,
      taxAmount: posStore.taxAmount,
      total: posStore.total,
      payment,
    }

    const backendPayload = {
      posTerminalId: payload.terminalId!,
      lines: payload.items.map((item) => ({
        itemId: item.itemId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPriceOverride: item.unitPrice,
      })),
      payments: [{
        method: payload.payment.method,
        amount: payload.payment.amount,
        reference: payload.payment.reference,
      }],
      discountAmount: payload.discountAmount,
      notes: payload.notes,
    }

    try {
      const response = await transactionsApi.checkout(backendPayload)
      const transaction = response.data as unknown as Transaction
      lastTransaction.value = transaction
      posStore.clearCart()
      return transaction
    } catch (err: unknown) {
      // Offline or network error — queue for later
      const isOffline = !navigator.onLine || (err as { code?: string })?.code === 'ERR_NETWORK'

      if (isOffline) {
        const pending: PendingTransaction = {
          localId: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          payload,
          createdAt: new Date().toISOString(),
          retryCount: 0,
        }
        posStore.addToOfflineQueue(pending)
        posStore.clearCart()
        $q.notify({
          type: 'warning',
          message: t('pos.savedOffline'),
          icon: 'cloud_off',
          timeout: 4000,
        })
        return null
      }

      throw err
    } finally {
      isProcessing.value = false
    }
  }

  async function flushOfflineQueue() {
    await posStore.flushOfflineQueue(async (pending) => {
      await transactionsApi.checkout(pending.payload)
    })
  }

  // Listen for online event to auto-flush
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      if (posStore.offlineQueue.length > 0) {
        flushOfflineQueue().then(() => {
          $q.notify({
            type: 'positive',
            message: `Synced ${posStore.offlineQueue.length === 0 ? 'all' : 'some'} offline transactions.`,
          })
        })
      }
    })
  }

  return {
    posStore,
    authStore,
    isProcessing,
    lastTransaction,
    checkout,
    flushOfflineQueue,
  }
}
