import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { CartItem, PendingTransaction } from '@/types/pos.types'

const OFFLINE_QUEUE_KEY = 'pos_offline_queue'

function loadOfflineQueue(): PendingTransaction[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveOfflineQueue(queue: PendingTransaction[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
}

export const usePOSStore = defineStore('pos', () => {
  const cart = ref<CartItem[]>([])
  const discountAmount = ref(0)
  const taxRate = ref(0) // percentage, e.g. 5 for 5%
  const offlineQueue = ref<PendingTransaction[]>(loadOfflineQueue())

  // ── Computed totals ────────────────────────────────────────────────────────
  const subtotal = computed(() =>
    cart.value.reduce((sum, item) => sum + item.price * item.quantity, 0),
  )

  const taxAmount = computed(() =>
    Math.round(subtotal.value * (taxRate.value / 100) * 100) / 100,
  )

  const total = computed(() =>
    subtotal.value - discountAmount.value + taxAmount.value,
  )

  const cartItemCount = computed(() =>
    cart.value.reduce((sum, item) => sum + item.quantity, 0),
  )

  // ── Cart actions ───────────────────────────────────────────────────────────
  function addToCart(item: Omit<CartItem, 'quantity'> & { quantity?: number }) {
    const existing = cart.value.find(
      (c) => c.itemId === item.itemId && c.variantId === item.variantId,
    )
    if (existing) {
      existing.quantity += item.quantity ?? 1
    } else {
      cart.value.push({ ...item, quantity: item.quantity ?? 1 })
    }
  }

  function removeFromCart(itemId: string, variantId?: string) {
    cart.value = cart.value.filter(
      (c) => !(c.itemId === itemId && c.variantId === variantId),
    )
  }

  function updateQuantity(itemId: string, qty: number, variantId?: string) {
    const item = cart.value.find(
      (c) => c.itemId === itemId && c.variantId === variantId,
    )
    if (!item) return
    if (qty <= 0) {
      removeFromCart(itemId, variantId)
    } else {
      item.quantity = qty
    }
  }

  function clearCart() {
    cart.value = []
    discountAmount.value = 0
  }

  function setDiscount(amount: number) {
    discountAmount.value = Math.max(0, amount)
  }

  // ── Offline queue actions ──────────────────────────────────────────────────
  function addToOfflineQueue(tx: PendingTransaction) {
    offlineQueue.value.push(tx)
    saveOfflineQueue(offlineQueue.value)
  }

  function removeFromOfflineQueue(localId: string) {
    offlineQueue.value = offlineQueue.value.filter((t) => t.localId !== localId)
    saveOfflineQueue(offlineQueue.value)
  }

  async function flushOfflineQueue(
    checkoutFn: (tx: PendingTransaction) => Promise<void>,
  ) {
    const pending = [...offlineQueue.value]
    for (const tx of pending) {
      try {
        await checkoutFn(tx)
        removeFromOfflineQueue(tx.localId)
      } catch {
        // Will retry on next flush
        tx.retryCount = (tx.retryCount ?? 0) + 1
        saveOfflineQueue(offlineQueue.value)
      }
    }
  }

  return {
    cart,
    discountAmount,
    taxRate,
    offlineQueue,
    subtotal,
    taxAmount,
    total,
    cartItemCount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setDiscount,
    addToOfflineQueue,
    removeFromOfflineQueue,
    flushOfflineQueue,
  }
})
