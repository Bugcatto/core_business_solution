<template>
  <q-page padding>
    <!-- Header row -->
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5 text-weight-bold">Transactions</div>
    </div>

    <!-- Filters row -->
    <div class="row q-col-gutter-sm q-mb-md items-end">
      <!-- Date range preset -->
      <div class="col-auto">
        <q-select
          v-model="datePreset"
          :options="datePresetOptions"
          label="Date range"
          outlined
          dense
          emit-value
          map-options
          style="min-width: 160px; min-height: 44px"
          @update:model-value="onDatePresetChange"
        />
      </div>

      <!-- Custom date pickers — shown only when preset is 'custom' -->
      <template v-if="datePreset === 'custom'">
        <div class="col-auto">
          <q-input
            v-model="customStartDate"
            label="From"
            outlined
            dense
            style="min-width: 140px; min-height: 44px"
          >
            <template #append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="customStartDate" mask="YYYY-MM-DD" @update:model-value="applyFilters">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Close" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>
        <div class="col-auto">
          <q-input
            v-model="customEndDate"
            label="To"
            outlined
            dense
            style="min-width: 140px; min-height: 44px"
          >
            <template #append>
              <q-icon name="event" class="cursor-pointer">
                <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                  <q-date v-model="customEndDate" mask="YYYY-MM-DD" @update:model-value="applyFilters">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup label="Close" color="primary" flat />
                    </div>
                  </q-date>
                </q-popup-proxy>
              </q-icon>
            </template>
          </q-input>
        </div>
      </template>

      <!-- Status filter -->
      <div class="col-auto">
        <q-select
          v-model="statusFilter"
          :options="statusOptions"
          label="Status"
          outlined
          dense
          emit-value
          map-options
          style="min-width: 140px; min-height: 44px"
          @update:model-value="applyFilters"
        />
      </div>
    </div>

    <!-- Transactions table -->
    <q-table
      :rows="transactions"
      :columns="columns"
      row-key="id"
      flat
      bordered
      :loading="isLoading"
      :rows-per-page-options="[]"
      hide-bottom
      @row-click="(_, row) => openDetail(row)"
    >
      <template #body-cell-transactionNumber="props">
        <q-td :props="props" class="cursor-pointer">
          {{ props.value }}
        </q-td>
      </template>

      <template #body-cell-createdAt="props">
        <q-td :props="props" class="cursor-pointer">
          {{ formatDate(props.value) }}
        </q-td>
      </template>

      <template #body-cell-totalAmount="props">
        <q-td :props="props" class="cursor-pointer">
          {{ formatCurrency(props.value) }}
        </q-td>
      </template>

      <template #body-cell-status="props">
        <q-td :props="props" class="cursor-pointer">
          <q-badge :color="statusColor(props.value)">
            {{ props.value }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td :props="props" @click.stop>
          <q-btn
            flat
            dense
            round
            icon="visibility"
            @click="openDetail(props.row)"
          />
        </q-td>
      </template>

      <template #no-data>
        <div class="full-width text-center q-pa-xl text-grey-6">
          <q-icon name="receipt_long" size="48px" class="q-mb-md" />
          <div>No transactions found</div>
        </div>
      </template>
    </q-table>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="row justify-center q-mt-md">
      <q-pagination
        v-model="currentPage"
        :max="totalPages"
        boundary-links
        @update:model-value="loadTransactions"
      />
    </div>

    <!-- ── Detail dialog ───────────────────────────────────────────────── -->
    <q-dialog v-model="detailDialog" maximized>
      <q-card style="max-width: 680px; width: 100%; margin: auto">
        <!-- Detail loading state -->
        <template v-if="isDetailLoading">
          <q-card-section class="text-center q-pa-xl">
            <q-spinner size="48px" color="primary" />
          </q-card-section>
        </template>

        <template v-else-if="selectedTransaction">
          <!-- Header -->
          <q-card-section class="row items-center q-pb-none">
            <div class="col">
              <div class="text-subtitle1 text-weight-bold">
                {{ selectedTransaction.transactionNumber }}
              </div>
            </div>
            <q-badge :color="statusColor(selectedTransaction.status)" class="q-mr-sm">
              {{ selectedTransaction.status }}
            </q-badge>
            <q-btn flat round dense icon="close" v-close-popup />
          </q-card-section>

          <q-separator class="q-mt-sm" />

          <q-card-section class="q-pt-md">
            <!-- Line items -->
            <div class="text-subtitle2 q-mb-sm">Items</div>
            <q-table
              :rows="selectedTransaction.lines ?? []"
              :columns="lineColumns"
              row-key="id"
              flat
              bordered
              dense
              hide-bottom
              :rows-per-page-options="[]"
            >
              <template #body-cell-unitPrice="props">
                <q-td :props="props">{{ formatCurrency(props.value) }}</q-td>
              </template>
              <template #body-cell-lineTotal="props">
                <q-td :props="props">{{ formatCurrency(props.value) }}</q-td>
              </template>
              <template #no-data>
                <div class="text-center text-grey-6 q-pa-md">No line items</div>
              </template>
            </q-table>

            <!-- Totals block -->
            <div class="q-mt-md">
              <div class="row justify-end">
                <div style="min-width: 240px">
                  <div class="row justify-between q-py-xs">
                    <span class="text-grey-7">Subtotal</span>
                    <span>{{ formatCurrency(selectedTransaction.subtotal) }}</span>
                  </div>
                  <div v-if="selectedTransaction.discountAmount > 0" class="row justify-between q-py-xs">
                    <span class="text-grey-7">Discount</span>
                    <span class="text-negative">- {{ formatCurrency(selectedTransaction.discountAmount) }}</span>
                  </div>
                  <div v-if="selectedTransaction.taxAmount > 0" class="row justify-between q-py-xs">
                    <span class="text-grey-7">Tax</span>
                    <span>{{ formatCurrency(selectedTransaction.taxAmount) }}</span>
                  </div>
                  <q-separator class="q-my-xs" />
                  <div class="row justify-between q-py-xs text-weight-bold">
                    <span>Total</span>
                    <span>{{ formatCurrency(selectedTransaction.totalAmount) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Payments block -->
            <div v-if="selectedTransaction.payments?.length" class="q-mt-md">
              <div class="text-subtitle2 q-mb-sm">Payments</div>
              <div
                v-for="payment in selectedTransaction.payments"
                :key="payment.id"
                class="row justify-between q-py-xs"
              >
                <span class="text-grey-7 text-capitalize">{{ payment.paymentMethod }}</span>
                <span>
                  {{ formatCurrency(payment.amount) }}
                  <span v-if="payment.changeAmount && payment.changeAmount > 0" class="text-grey-6 text-caption q-ml-xs">
                    (change: {{ formatCurrency(payment.changeAmount) }})
                  </span>
                </span>
              </div>
            </div>

            <!-- Footer: date + createdBy -->
            <q-separator class="q-my-md" />
            <div class="text-caption text-grey-6">
              <span>{{ formatDate(selectedTransaction.createdAt) }}</span>
              <span class="q-ml-md">Created by: {{ selectedTransaction.createdBy?.substring(0, 8) }}</span>
            </div>
          </q-card-section>

          <!-- Action buttons -->
          <q-card-actions
            v-if="selectedTransaction.status === 'completed'"
            align="right"
            class="q-px-md q-pb-md"
          >
            <q-btn
              v-if="tenantStore.hasPermission('pos.sale.void')"
              label="Void"
              color="grey-7"
              unelevated
              style="min-height: 44px"
              @click="openVoidDialog"
            />
            <q-btn
              v-if="tenantStore.hasPermission('pos.sale.refund')"
              label="Refund"
              color="orange"
              unelevated
              style="min-height: 44px"
              @click="openRefundDialog"
            />
          </q-card-actions>
        </template>
      </q-card>
    </q-dialog>

    <!-- ── Void confirm dialog ─────────────────────────────────────────── -->
    <q-dialog v-model="voidDialog">
      <q-card style="min-width: 360px">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold">Void Transaction</div>
          <div class="text-caption text-grey-6 q-mt-xs">This action cannot be undone.</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-input
            v-model="voidReason"
            label="Reason"
            outlined
            autofocus
            style="min-height: 44px"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup style="min-height: 44px" />
          <q-btn
            label="Confirm Void"
            color="negative"
            unelevated
            :loading="isActioning"
            :disable="!voidReason.trim()"
            style="min-height: 44px"
            @click="doVoid"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ── Refund dialog ───────────────────────────────────────────────── -->
    <q-dialog v-model="refundDialog">
      <q-card style="min-width: 400px">
        <q-card-section>
          <div class="text-subtitle1 text-weight-bold">Refund Transaction</div>
          <div class="text-caption text-grey-6 q-mt-xs">Full refund for all items.</div>
        </q-card-section>
        <q-card-section class="q-pt-none q-gutter-sm">
          <q-input
            v-model="refundReason"
            label="Reason"
            outlined
            autofocus
            style="min-height: 44px"
          />
          <q-select
            v-model="refundPaymentMethod"
            :options="refundMethodOptions"
            label="Refund via"
            outlined
            emit-value
            map-options
            style="min-height: 44px"
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup style="min-height: 44px" />
          <q-btn
            label="Confirm Refund"
            color="orange"
            unelevated
            :loading="isActioning"
            :disable="!refundReason.trim()"
            style="min-height: 44px"
            @click="doRefund"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { transactionsApi } from '@/api/transactions.api'
import { useTenantStore } from '@/stores/tenant.store'

// ── Types ────────────────────────────────────────────────────────────────────

interface TransactionLine {
  id: string
  itemId: string
  variantId: string | null
  itemNameSnapshot: string
  variantNameSnapshot: string | null
  skuSnapshot: string | null
  unitPrice: number
  quantity: number
  discountAmount: number
  lineTotal: number
}

interface TransactionPayment {
  id: string
  paymentMethod: string
  amount: number
  amountTendered: number | null
  changeAmount: number | null
  status: string
  paidAt: string
}

interface TransactionDetail {
  id: string
  transactionNumber: string
  businessId: string
  branchId: string
  posTerminalId: string
  createdBy: string
  transactionType: 'sale' | 'refund'
  status: 'open' | 'completed' | 'voided' | 'refunded'
  subtotal: number
  discountAmount: number
  taxAmount: number
  totalAmount: number
  notes: string | null
  createdAt: string
  completedAt: string | null
  lines?: TransactionLine[]
  payments?: TransactionPayment[]
}

// ── Store & Quasar ────────────────────────────────────────────────────────────

const $q = useQuasar()
const tenantStore = useTenantStore()

// ── State ────────────────────────────────────────────────────────────────────

const transactions = ref<TransactionDetail[]>([])
const isLoading = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)

// Filters
type DatePreset = 'today' | 'last7' | 'last30' | 'custom'
const datePreset = ref<DatePreset>('today')
const customStartDate = ref('')
const customEndDate = ref('')
const statusFilter = ref<string>('')

// Detail
const detailDialog = ref(false)
const isDetailLoading = ref(false)
const selectedTransaction = ref<TransactionDetail | null>(null)

// Void
const voidDialog = ref(false)
const voidReason = ref('')
const isActioning = ref(false)

// Refund
const refundDialog = ref(false)
const refundReason = ref('')
const refundPaymentMethod = ref<string>('cash')

// ── Options ──────────────────────────────────────────────────────────────────

const datePresetOptions = [
  { label: 'Today',       value: 'today' },
  { label: 'Last 7 days', value: 'last7' },
  { label: 'Last 30 days', value: 'last30' },
  { label: 'Custom range', value: 'custom' },
]

const statusOptions = [
  { label: 'All',       value: '' },
  { label: 'Completed', value: 'completed' },
  { label: 'Voided',    value: 'voided' },
  { label: 'Refunded',  value: 'refunded' },
]

const refundMethodOptions = [
  { label: 'Cash',          value: 'cash' },
  { label: 'Card',          value: 'card' },
  { label: 'QR',            value: 'qr' },
  { label: 'Bank Transfer', value: 'bank_transfer' },
  { label: 'Other',         value: 'other' },
]

// ── Table columns ─────────────────────────────────────────────────────────────

const columns = [
  { name: 'transactionNumber', label: 'Transaction #', field: 'transactionNumber', align: 'left' as const, sortable: false },
  { name: 'createdAt',         label: 'Date',          field: 'createdAt',         align: 'left' as const, sortable: false },
  { name: 'totalAmount',       label: 'Total',         field: 'totalAmount',       align: 'right' as const, sortable: false },
  { name: 'status',            label: 'Status',        field: 'status',            align: 'center' as const, sortable: false },
  { name: 'actions',           label: '',              field: 'actions',           align: 'right' as const },
]

const lineColumns = [
  { name: 'itemNameSnapshot', label: 'Item',       field: 'itemNameSnapshot', align: 'left' as const },
  { name: 'quantity',         label: 'Qty',        field: 'quantity',         align: 'center' as const },
  { name: 'unitPrice',        label: 'Unit Price', field: 'unitPrice',        align: 'right' as const },
  { name: 'lineTotal',        label: 'Line Total', field: 'lineTotal',        align: 'right' as const },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return `${value.toLocaleString()} MMK`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusColor(status: string): string {
  switch (status) {
    case 'completed': return 'positive'
    case 'voided':    return 'grey-6'
    case 'refunded':  return 'orange'
    default:          return 'grey-4'
  }
}

function getDateRange(): { startDate?: string; endDate?: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')

  function toDateStr(d: Date): string {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  if (datePreset.value === 'today') {
    const today = toDateStr(now)
    return { startDate: today, endDate: today }
  }
  if (datePreset.value === 'last7') {
    const from = new Date(now)
    from.setDate(from.getDate() - 6)
    return { startDate: toDateStr(from), endDate: toDateStr(now) }
  }
  if (datePreset.value === 'last30') {
    const from = new Date(now)
    from.setDate(from.getDate() - 29)
    return { startDate: toDateStr(from), endDate: toDateStr(now) }
  }
  if (datePreset.value === 'custom') {
    return {
      startDate: customStartDate.value || undefined,
      endDate: customEndDate.value || undefined,
    }
  }
  return {}
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadTransactions() {
  isLoading.value = true
  try {
    const { startDate, endDate } = getDateRange()
    const res = await transactionsApi.list({
      page: currentPage.value,
      limit: 20,
      startDate,
      endDate,
      status: statusFilter.value || undefined,
    })
    const data = res.data as unknown as { items: TransactionDetail[]; total: number; page: number; totalPages: number }
    transactions.value = data.items ?? []
    totalPages.value = data.totalPages ?? 1
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to load transactions' })
  } finally {
    isLoading.value = false
  }
}

function onDatePresetChange() {
  if (datePreset.value !== 'custom') {
    applyFilters()
  }
}

function applyFilters() {
  currentPage.value = 1
  loadTransactions()
}

// ── Detail dialog ─────────────────────────────────────────────────────────────

async function openDetail(row: TransactionDetail) {
  selectedTransaction.value = null
  detailDialog.value = true
  isDetailLoading.value = true
  try {
    const res = await transactionsApi.getById(row.id)
    selectedTransaction.value = res.data as unknown as TransactionDetail
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to load transaction details' })
    detailDialog.value = false
  } finally {
    isDetailLoading.value = false
  }
}

// ── Void ──────────────────────────────────────────────────────────────────────

function openVoidDialog() {
  voidReason.value = ''
  voidDialog.value = true
}

async function doVoid() {
  if (!selectedTransaction.value) return
  isActioning.value = true
  try {
    await transactionsApi.void(selectedTransaction.value.id, voidReason.value)
    $q.notify({ type: 'positive', message: 'Transaction voided' })
    voidDialog.value = false
    detailDialog.value = false
    await loadTransactions()
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to void transaction' })
  } finally {
    isActioning.value = false
  }
}

// ── Refund ────────────────────────────────────────────────────────────────────

function openRefundDialog() {
  refundReason.value = ''
  refundPaymentMethod.value = 'cash'
  refundDialog.value = true
}

async function doRefund() {
  if (!selectedTransaction.value) return
  isActioning.value = true
  try {
    // Full refund: all lines at their original quantities
    const lines = (selectedTransaction.value.lines ?? []).map((l) => ({
      transactionLineId: l.id,
      quantity: l.quantity,
    }))
    await transactionsApi.refund(selectedTransaction.value.id, {
      lines,
      reason: refundReason.value,
      paymentMethod: refundPaymentMethod.value as 'cash' | 'card' | 'qr' | 'bank_transfer' | 'other',
    })
    $q.notify({ type: 'positive', message: 'Transaction refunded' })
    refundDialog.value = false
    detailDialog.value = false
    await loadTransactions()
  } catch {
    $q.notify({ type: 'negative', message: 'Failed to refund transaction' })
  } finally {
    isActioning.value = false
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

onMounted(loadTransactions)
</script>
