<template>
  <q-page class="pos-page column no-wrap" style="height: 100vh; overflow: hidden">
    <!-- POS Header bar -->
    <div class="pos-header row items-center justify-between q-px-md bg-dark text-white"
         style="min-height: 52px; flex-shrink: 0">
      <div class="row items-center q-gutter-sm">
        <q-icon name="point_of_sale" color="primary" />
        <span class="text-weight-bold">{{ tenantStore.branchName }}</span>
        <q-badge color="grey-7" class="q-ml-xs">
          {{ t('pos.terminal') }}: {{ tenantStore.terminalId ?? 'T1' }}
        </q-badge>
        <q-badge color="grey-7">
          {{ t('pos.cashier') }}: {{ authStore.user?.displayName ?? authStore.user?.email }}
        </q-badge>
        <q-badge v-if="!isOnline" color="warning" text-color="dark">
          <q-icon name="cloud_off" size="12px" class="q-mr-xs" />
          {{ t('pos.offlineMode') }}
        </q-badge>
      </div>

      <div class="row items-center q-gutter-sm">
        <q-btn
          flat
          color="white"
          :label="t('pos.endShift')"
          icon="logout"
          size="sm"
          style="min-height: 36px"
          :to="{ name: 'Dashboard' }"
        />
      </div>
    </div>

    <!-- Industry-specific extra fields -->
    <div
      v-if="showTableSelector || showPrescriptionField || showStudentSearch"
      class="pos-context-bar row q-gutter-sm q-px-md q-py-xs bg-grey-1"
      style="flex-shrink: 0"
    >
      <q-input
        v-if="showTableSelector"
        v-model="contextFields.tableNumber"
        :label="t('pos.tableNumber')"
        outlined dense
        style="max-width: 160px; min-height: 44px"
      />
      <q-input
        v-if="showPrescriptionField"
        v-model="contextFields.prescriptionRef"
        :label="t('pos.prescriptionRef')"
        outlined dense
        style="max-width: 220px; min-height: 44px"
      />
      <q-input
        v-if="showStudentSearch"
        v-model="contextFields.studentId"
        :label="t('pos.studentId')"
        outlined dense
        style="max-width: 200px; min-height: 44px"
      />
    </div>

    <!-- Main content: product grid + cart -->
    <div class="pos-body row col" style="overflow: hidden; flex: 1">
      <!-- Left: Product grid (60%) -->
      <div class="pos-left col-12 col-md-7 column no-wrap" style="border-right: 1px solid #e0e0e0">
        <ProductGrid @select="onProductSelect" />
      </div>

      <!-- Right: Cart panel (40%) -->
      <div class="pos-right col-12 col-md-5 column no-wrap">
        <CartPanel @charge="showPaymentDialog = true" />
      </div>
    </div>

    <!-- Payment dialog -->
    <PaymentDialog
      v-model="showPaymentDialog"
      :total="posStore.total"
      :is-processing="isProcessing"
      @confirm="onPaymentConfirm"
    />

    <!-- Receipt dialog -->
    <ReceiptDialog
      v-model="showReceiptDialog"
      :transaction="lastTransaction"
      @new-sale="onNewSale"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useTenantStore } from '@/stores/tenant.store'
import { usePOSStore } from '@/stores/pos.store'
import { usePOS } from '@/composables/usePOS'
import { useIndustryConfig } from '@/composables/useIndustryConfig'
import ProductGrid from '@/components/pos/ProductGrid.vue'
import CartPanel from '@/components/pos/CartPanel.vue'
import PaymentDialog from '@/components/pos/PaymentDialog.vue'
import ReceiptDialog from '@/components/pos/ReceiptDialog.vue'
import type { Item, PaymentDetail } from '@/types/pos.types'
import { useQuasar } from 'quasar'

const { t } = useI18n()
const $q = useQuasar()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const posStore = usePOSStore()
const { checkout, isProcessing, lastTransaction, flushOfflineQueue } = usePOS()
const { showTableSelector, showPrescriptionField, showStudentSearch } = useIndustryConfig()

const showPaymentDialog = ref(false)
const showReceiptDialog = ref(false)
const isOnline = ref(navigator.onLine)

const contextFields = ref({
  tableNumber: '',
  prescriptionRef: '',
  studentId: '',
})

function onProductSelect(item: Item) {
  posStore.addToCart({
    itemId: item.id,
    name: item.name,
    price: item.price,
  })
}

async function onPaymentConfirm(payment: PaymentDetail) {
  try {
    const transaction = await checkout(payment)
    showPaymentDialog.value = false

    if (transaction) {
      lastTransaction.value = transaction
      showReceiptDialog.value = true
    }
    // If null, it went to offline queue — toast already shown in usePOS
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t('common.error')
    $q.notify({ type: 'negative', message })
  }
}

function onNewSale() {
  posStore.clearCart()
  contextFields.value = { tableNumber: '', prescriptionRef: '', studentId: '' }
  showReceiptDialog.value = false
}

function handleOnline() {
  isOnline.value = true
  flushOfflineQueue()
}

function handleOffline() {
  isOnline.value = false
}

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<style scoped>
.pos-page {
  background: #f5f5f5;
}

.pos-left,
.pos-right {
  background: #fff;
}

@media (max-width: 1023px) {
  .pos-left,
  .pos-right {
    height: auto;
    overflow-y: auto;
  }
  .pos-body {
    overflow-y: auto;
  }
}
</style>
