<template>
  <q-dialog v-model="open" persistent>
    <q-card style="min-width: 360px; max-width: 480px; width: 100%">
      <q-card-section class="row items-center justify-between">
        <div class="text-h6">{{ t('pos.paymentMethod') }}</div>
        <q-btn flat round dense icon="close" v-close-popup />
      </q-card-section>

      <q-separator />

      <q-card-section>
        <!-- Amount due -->
        <div class="text-center q-mb-lg">
          <div class="text-caption text-grey-6">{{ t('pos.total') }}</div>
          <div class="text-h4 text-weight-bold text-primary">{{ formatPrice(total) }}</div>
        </div>

        <!-- Payment method selection -->
        <div class="row q-gutter-sm q-mb-md">
          <q-btn
            v-for="method in paymentMethods"
            :key="method.value"
            :label="t(method.labelKey)"
            :icon="method.icon"
            :outline="selectedMethod !== method.value"
            :color="selectedMethod === method.value ? 'primary' : 'grey-7'"
            class="col"
            style="min-height: 52px"
            @click="selectedMethod = method.value"
          />
        </div>

        <!-- Cash tendered input (only for cash) -->
        <template v-if="selectedMethod === 'cash'">
          <q-input
            v-model.number="tendered"
            :label="t('pos.amountTendered')"
            outlined
            type="number"
            :min="total"
            class="q-mb-sm"
            input-style="min-height: 44px; font-size: 1.2rem"
          />

          <div v-if="change >= 0" class="row justify-between items-center text-positive q-px-xs">
            <span>{{ t('pos.change') }}</span>
            <span class="text-h6 text-weight-bold">{{ formatPrice(change) }}</span>
          </div>
        </template>

        <!-- Reference for card/KPay/QR -->
        <template v-if="['card', 'kpay', 'qr'].includes(selectedMethod)">
          <q-input
            v-model="reference"
            :label="t('common.optional') + ' — Reference / Approval Code'"
            outlined
            input-style="min-height: 44px"
          />
        </template>
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn
          flat
          :label="t('common.cancel')"
          v-close-popup
          style="min-height: 44px"
          :disable="isProcessing"
        />
        <q-btn
          :label="t('pos.confirmPayment')"
          color="primary"
          unelevated
          style="min-height: 44px; min-width: 140px"
          :loading="isProcessing"
          :disable="!canConfirm"
          @click="onConfirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PaymentMethod, PaymentDetail } from '@/types/pos.types'

const props = defineProps<{
  modelValue: boolean
  total: number
  isProcessing?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  confirm: [payment: PaymentDetail]
}>()

const { t } = useI18n()

const open = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const selectedMethod = ref<PaymentMethod>('cash')
const tendered = ref(props.total)
const reference = ref('')

watch(() => props.total, (val) => { tendered.value = val })

const change = computed(() => tendered.value - props.total)

const canConfirm = computed(() => {
  if (selectedMethod.value === 'cash') return tendered.value >= props.total
  return true
})

const paymentMethods = [
  { value: 'cash' as PaymentMethod, labelKey: 'pos.cash', icon: 'payments' },
  { value: 'card' as PaymentMethod, labelKey: 'pos.card', icon: 'credit_card' },
  { value: 'kpay' as PaymentMethod, labelKey: 'pos.kpay', icon: 'phone_android' },
  { value: 'qr' as PaymentMethod, labelKey: 'pos.qr', icon: 'qr_code' },
]

function formatPrice(val: number) {
  return `${val.toLocaleString()} MMK`
}

function onConfirm() {
  emit('confirm', {
    method: selectedMethod.value,
    amount: selectedMethod.value === 'cash' ? tendered.value : props.total,
    reference: reference.value || undefined,
  })
}
</script>
