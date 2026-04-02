<template>
  <q-page padding>
    <!-- Welcome header -->
    <div class="q-mb-lg">
      <div class="text-h5 text-weight-bold">
        {{ t('dashboard.welcome') }}, {{ authStore.user?.displayName ?? authStore.user?.email }}
      </div>
      <div class="text-caption text-grey-6">{{ tenantStore.businessName }} · {{ tenantStore.branchName }}</div>
    </div>

    <!-- Summary cards -->
    <div class="row q-gutter-md q-mb-xl">
      <q-card flat bordered class="col-12 col-sm-6 col-md-3" v-for="card in summaryCards" :key="card.label">
        <q-card-section>
          <div class="row items-center justify-between">
            <div>
              <div class="text-caption text-grey-6">{{ card.label }}</div>
              <div class="text-h4 text-weight-bold q-mt-xs">{{ card.value }}</div>
            </div>
            <q-icon :name="card.icon" size="40px" :color="card.color" class="opacity-40" />
          </div>
        </q-card-section>
      </q-card>
    </div>

    <!-- Quick actions -->
    <div class="text-subtitle1 text-weight-bold q-mb-md">{{ t('dashboard.quickActions') }}</div>
    <div class="row q-gutter-md">
      <q-btn
        :label="t('dashboard.openPOS')"
        color="primary"
        unelevated
        icon="point_of_sale"
        :to="{ name: 'POS' }"
        style="min-height: 48px"
      />
      <q-btn
        :label="t('dashboard.manageItems')"
        outline
        color="primary"
        icon="inventory_2"
        :to="{ name: 'Items' }"
        style="min-height: 48px"
      />
    </div>

    <!-- Offline queue alert -->
    <q-banner
      v-if="posStore.offlineQueue.length > 0"
      class="q-mt-xl bg-warning text-white"
      rounded
    >
      <template #avatar>
        <q-icon name="cloud_off" />
      </template>
      {{ posStore.offlineQueue.length }} offline transaction(s) pending sync.
      <template #action>
        <q-btn flat :label="t('common.retry')" @click="flushQueue" />
      </template>
    </q-banner>
  </q-page>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useTenantStore } from '@/stores/tenant.store'
import { usePOSStore } from '@/stores/pos.store'
import { usePOS } from '@/composables/usePOS'

const { t } = useI18n()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const posStore = usePOSStore()
const { flushOfflineQueue } = usePOS()

const summaryCards = [
  { label: t('dashboard.todaySales'), value: '—', icon: 'attach_money', color: 'positive' },
  { label: t('dashboard.transactions'), value: '—', icon: 'receipt_long', color: 'primary' },
  { label: t('items.title'), value: '—', icon: 'inventory_2', color: 'secondary' },
  { label: t('dashboard.topItems'), value: '—', icon: 'star', color: 'warning' },
]

async function flushQueue() {
  await flushOfflineQueue()
}
</script>
