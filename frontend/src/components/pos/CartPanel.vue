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

      <div v-if="posStore.discountAmount > 0" class="row justify-between q-mb-xs text-negative">
        <span>{{ t('pos.discount') }}</span>
        <span>-{{ formatPrice(posStore.discountAmount) }}</span>
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
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usePOSStore } from '@/stores/pos.store'

defineEmits<{ charge: [] }>()

const { t } = useI18n()
const posStore = usePOSStore()

function formatPrice(val: number) {
  return `${val.toLocaleString()} MMK`
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
