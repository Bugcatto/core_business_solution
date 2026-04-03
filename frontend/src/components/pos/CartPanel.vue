<template>
  <div class="cart-panel column no-wrap full-height">
    <!-- Cart header -->
    <div class="cart-panel__header q-px-md q-py-sm row items-center justify-between">
      <div class="text-subtitle1 text-weight-bold">{{ t('pos.cart') }}</div>
      <q-btn
        v-if="posStore.cart.length > 0"
        flat
        dense
        round
        icon="delete_sweep"
        color="negative"
        :title="t('pos.clearCart')"
        @click="posStore.clearCart()"
      />
    </div>

    <q-separator />

    <!-- Cart items -->
    <div class="cart-panel__items col q-pa-sm">
      <div
        v-if="posStore.cart.length === 0"
        class="full-height flex flex-center text-grey-5 text-center"
      >
        <div>
          <q-icon name="shopping_cart" size="48px" />
          <div class="q-mt-sm">{{ t('pos.emptyCart') }}</div>
        </div>
      </div>

      <q-list v-else dense>
        <q-item
          v-for="item in posStore.cart"
          :key="`${item.itemId}-${item.variantId}`"
          class="cart-item q-mb-xs"
        >
          <q-item-section>
            <q-item-label class="text-weight-medium">{{ item.name }}</q-item-label>
            <q-item-label caption>{{ formatPrice(item.price) }} × {{ item.quantity }}</q-item-label>
          </q-item-section>

          <q-item-section side class="row items-center">
            <div class="row items-center no-wrap">
              <q-btn
                flat dense round icon="remove" size="xs"
                @click="posStore.updateQuantity(item.itemId, item.quantity - 1, item.variantId)"
              />
              <span class="q-px-xs text-weight-bold" style="min-width: 24px; text-align: center">
                {{ item.quantity }}
              </span>
              <q-btn
                flat dense round icon="add" size="xs"
                @click="posStore.updateQuantity(item.itemId, item.quantity + 1, item.variantId)"
              />
            </div>
            <div class="text-weight-bold text-primary q-mt-xs">
              {{ formatPrice(item.price * item.quantity) }}
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <q-separator />

    <!-- Totals -->
    <div class="cart-panel__totals q-px-md q-py-sm">
      <div class="row justify-between q-mb-xs">
        <span class="text-grey-7">{{ t('pos.subtotal') }}</span>
        <span>{{ formatPrice(posStore.subtotal) }}</span>
      </div>

      <!-- Discount row: shows amount when set, with edit trigger -->
      <div class="row justify-between items-center q-mb-xs">
        <q-btn
          flat
          dense
          no-caps
          :color="posStore.discountAmount > 0 ? 'negative' : 'grey-7'"
          :icon="posStore.discountAmount > 0 ? 'local_offer' : 'add'"
          :label="posStore.discountAmount > 0 ? `Discount: -${formatPrice(posStore.discountAmount)}` : 'Add Discount'"
          style="min-height: 44px"
          :disable="posStore.cart.length === 0"
          @click="openDiscountDialog"
        />
        <q-btn
          v-if="posStore.discountAmount > 0"
          flat
          dense
          round
          icon="close"
          color="negative"
          size="sm"
          title="Remove discount"
          style="min-height: 44px; min-width: 44px"
          @click="posStore.setDiscount(0)"
        />
      </div>

      <div v-if="posStore.taxAmount > 0" class="row justify-between q-mb-xs">
        <span class="text-grey-7">{{ t('pos.tax') }}</span>
        <span>{{ formatPrice(posStore.taxAmount) }}</span>
      </div>

      <q-separator class="q-my-sm" />

      <div class="row justify-between items-center">
        <span class="text-subtitle1 text-weight-bold">{{ t('pos.total') }}</span>
        <span class="text-h6 text-weight-bold text-primary">{{ formatPrice(posStore.total) }}</span>
      </div>
    </div>

    <!-- Charge button -->
    <div class="cart-panel__action q-px-md q-pb-md q-pt-sm">
      <q-btn
        :label="`${t('pos.charge')} ${formatPrice(posStore.total)}`"
        color="primary"
        unelevated
        class="full-width"
        style="min-height: 52px; font-size: 1rem"
        :disable="posStore.cart.length === 0"
        @click="$emit('charge')"
      />
    </div>
  </div>

  <!-- Discount dialog -->
  <q-dialog v-model="discountDialogOpen" persistent>
    <q-card style="min-width: 320px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-subtitle1 text-weight-bold">Add Discount</div>
        <q-space />
        <q-btn icon="close" flat round dense @click="closeDiscountDialog" />
      </q-card-section>

      <q-card-section>
        <!-- Subtotal reference -->
        <div class="text-grey-7 q-mb-md" style="font-size: 0.85rem">
          Subtotal: {{ formatPrice(posStore.subtotal) }}
        </div>

        <!-- Preset percentage buttons -->
        <div class="row q-gutter-sm q-mb-md">
          <q-btn
            v-for="pct in presetPercentages"
            :key="pct"
            :label="`${pct}%`"
            :outline="selectedPreset !== pct"
            :unelevated="selectedPreset === pct"
            :color="selectedPreset === pct ? 'primary' : 'grey-6'"
            no-caps
            style="min-height: 44px; flex: 1"
            @click="selectPreset(pct)"
          />
          <q-btn
            label="Custom"
            :outline="selectedPreset !== 'custom'"
            :unelevated="selectedPreset === 'custom'"
            :color="selectedPreset === 'custom' ? 'primary' : 'grey-6'"
            no-caps
            style="min-height: 44px; flex: 1"
            @click="selectPreset('custom')"
          />
        </div>

        <!-- Calculated amount preview for percentage presets -->
        <div
          v-if="selectedPreset !== null && selectedPreset !== 'custom'"
          class="text-negative text-weight-medium q-mb-md"
        >
          Discount amount: -{{ formatPrice(calculatedPresetAmount) }}
        </div>

        <!-- Custom amount input -->
        <q-input
          v-if="selectedPreset === 'custom'"
          v-model.number="customAmount"
          type="number"
          label="Discount amount (MMK)"
          outlined
          dense
          min="0"
          :max="posStore.subtotal"
          style="min-height: 44px"
          @keyup.enter="applyDiscount"
        >
          <template #append>
            <span class="text-grey-6" style="font-size: 0.8rem">MMK</span>
          </template>
        </q-input>
      </q-card-section>

      <q-card-actions align="right" class="q-px-md q-pb-md">
        <q-btn
          flat
          label="Cancel"
          color="grey-7"
          no-caps
          style="min-height: 44px"
          @click="closeDiscountDialog"
        />
        <q-btn
          unelevated
          label="Apply"
          color="primary"
          no-caps
          style="min-height: 44px"
          :disable="selectedPreset === null || (selectedPreset === 'custom' && !(customAmount > 0))"
          @click="applyDiscount"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePOSStore } from '@/stores/pos.store'

defineEmits<{ charge: [] }>()

const { t } = useI18n()
const posStore = usePOSStore()

function formatPrice(val: number) {
  return `${val.toLocaleString()} MMK`
}

// ── Discount dialog state ──────────────────────────────────────────────────
const discountDialogOpen = ref(false)
const presetPercentages = [10, 15, 20] as const
const selectedPreset = ref<10 | 15 | 20 | 'custom' | null>(null)
const customAmount = ref<number | null>(null)

const calculatedPresetAmount = computed(() => {
  if (selectedPreset.value === null || selectedPreset.value === 'custom') return 0
  return Math.round(posStore.subtotal * (selectedPreset.value / 100))
})

function openDiscountDialog() {
  // Pre-populate state if a discount is already set
  if (posStore.discountAmount > 0) {
    const matchedPct = presetPercentages.find(
      (pct) => Math.round(posStore.subtotal * (pct / 100)) === posStore.discountAmount,
    )
    if (matchedPct) {
      selectedPreset.value = matchedPct
      customAmount.value = null
    } else {
      selectedPreset.value = 'custom'
      customAmount.value = posStore.discountAmount
    }
  } else {
    selectedPreset.value = null
    customAmount.value = null
  }
  discountDialogOpen.value = true
}

function closeDiscountDialog() {
  discountDialogOpen.value = false
}

function selectPreset(value: 10 | 15 | 20 | 'custom') {
  selectedPreset.value = value
  if (value !== 'custom') customAmount.value = null
}

function applyDiscount() {
  if (selectedPreset.value === null) return
  if (selectedPreset.value === 'custom') {
    const amount = customAmount.value ?? 0
    posStore.setDiscount(Math.min(amount, posStore.subtotal))
  } else {
    posStore.setDiscount(calculatedPresetAmount.value)
  }
  closeDiscountDialog()
}
</script>

<style scoped>
.cart-panel {
  background: #fff;
}

.cart-panel__items {
  overflow-y: auto;
}

.cart-item {
  border-radius: 8px;
  background: #f9f9f9;
}
</style>
