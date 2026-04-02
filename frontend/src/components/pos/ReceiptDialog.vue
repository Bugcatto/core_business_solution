<template>
  <q-dialog v-model="open">
    <q-card style="min-width: 320px; max-width: 400px; width: 100%">
      <q-card-section class="text-center bg-positive text-white">
        <q-icon name="check_circle" size="48px" />
        <div class="text-h6 text-weight-bold q-mt-sm">{{ t('pos.transactionSuccess') }}</div>
        <div class="text-caption">
          {{ t('pos.transactionNumber') }}{{ transaction?.transactionNumber }}
        </div>
      </q-card-section>

      <q-card-section>
        <!-- Items list -->
        <q-list dense>
          <q-item v-for="item in transaction?.items" :key="item.itemId">
            <q-item-section>
              <q-item-label>{{ item.name }}</q-item-label>
              <q-item-label caption>{{ item.quantity }} × {{ formatPrice(item.unitPrice) }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              {{ formatPrice(item.total) }}
            </q-item-section>
          </q-item>
        </q-list>

        <q-separator class="q-my-sm" />

        <!-- Totals -->
        <div class="q-gutter-xs">
          <div class="row justify-between text-caption text-grey-7">
            <span>{{ t('pos.subtotal') }}</span>
            <span>{{ formatPrice(transaction?.subtotal ?? 0) }}</span>
          </div>
          <div v-if="(transaction?.discountAmount ?? 0) > 0" class="row justify-between text-caption text-negative">
            <span>{{ t('pos.discount') }}</span>
            <span>-{{ formatPrice(transaction?.discountAmount ?? 0) }}</span>
          </div>
          <div v-if="(transaction?.taxAmount ?? 0) > 0" class="row justify-between text-caption text-grey-7">
            <span>{{ t('pos.tax') }}</span>
            <span>{{ formatPrice(transaction?.taxAmount ?? 0) }}</span>
          </div>
          <div class="row justify-between text-weight-bold">
            <span>{{ t('pos.total') }}</span>
            <span class="text-primary">{{ formatPrice(transaction?.total ?? 0) }}</span>
          </div>
        </div>

        <q-separator class="q-my-sm" />

        <!-- Payment info -->
        <div class="row justify-between text-caption text-grey-6">
          <span>{{ t('pos.paymentMethod') }}</span>
          <span class="text-capitalize">{{ transaction?.payment?.method }}</span>
        </div>
        <div class="text-caption text-grey-5 text-right q-mt-xs">
          {{ formatDateTime(transaction?.createdAt) }}
        </div>
      </q-card-section>

      <q-card-actions align="between" class="q-px-md q-pb-md">
        <q-btn
          outline
          color="grey-7"
          icon="print"
          :label="t('pos.printReceipt')"
          style="min-height: 44px"
          @click="onPrint"
        />
        <q-btn
          color="primary"
          unelevated
          icon="add_shopping_cart"
          :label="t('pos.newSale')"
          style="min-height: 44px"
          @click="onNewSale"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Transaction } from '@/types/pos.types'

const props = defineProps<{
  modelValue: boolean
  transaction: Transaction | null
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  newSale: []
}>()

const { t } = useI18n()

const open = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

function formatPrice(val: number) {
  return `${val.toLocaleString()} MMK`
}

function formatDateTime(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}

function onPrint() {
  window.print()
}

function onNewSale() {
  emit('newSale')
  open.value = false
}
</script>
