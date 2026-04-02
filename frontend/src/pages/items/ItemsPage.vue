<template>
  <q-page padding>
    <!-- Header row -->
    <div class="row items-center justify-between q-mb-md">
      <div class="text-h5 text-weight-bold">{{ t('items.title') }}</div>
      <q-btn
        v-if="tenantStore.hasPermission('items.manage')"
        :label="t('items.addItem')"
        color="primary"
        unelevated
        icon="add"
        :to="{ name: 'ItemNew' }"
        style="min-height: 44px"
      />
    </div>

    <!-- Search -->
    <q-input
      v-model="search"
      :placeholder="t('common.search')"
      outlined
      dense
      clearable
      class="q-mb-md"
      style="max-width: 400px"
      @update:model-value="onSearch"
    >
      <template #prepend>
        <q-icon name="search" />
      </template>
    </q-input>

    <!-- Items table -->
    <q-table
      :rows="items"
      :columns="columns"
      row-key="id"
      flat
      bordered
      :loading="isLoading"
      :rows-per-page-options="[20, 50, 100]"
    >
      <template #body-cell-isActive="props">
        <q-td :props="props">
          <q-badge :color="props.value ? 'positive' : 'grey-5'">
            {{ props.value ? t('items.active') : t('items.inactive') }}
          </q-badge>
        </q-td>
      </template>

      <template #body-cell-price="props">
        <q-td :props="props">
          {{ formatPrice(props.value) }}
        </q-td>
      </template>

      <template #body-cell-actions="props">
        <q-td :props="props">
          <q-btn
            v-if="tenantStore.hasPermission('items.manage')"
            flat
            dense
            round
            icon="edit"
            :to="{ name: 'ItemEdit', params: { id: props.row.id } }"
          />
          <q-btn
            v-if="tenantStore.hasPermission('items.manage')"
            flat
            dense
            round
            icon="delete"
            color="negative"
            @click="confirmDelete(props.row)"
          />
        </q-td>
      </template>

      <template #no-data>
        <div class="full-width text-center q-pa-xl text-grey-6">
          <q-icon name="inventory_2" size="48px" class="q-mb-md" />
          <div>{{ t('items.noItems') }}</div>
        </div>
      </template>
    </q-table>

    <!-- Delete confirm dialog -->
    <q-dialog v-model="deleteDialog">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-subtitle1">{{ t('items.confirmDelete') }}</div>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat :label="t('common.cancel')" v-close-popup />
          <q-btn
            :label="t('common.delete')"
            color="negative"
            unelevated
            :loading="isDeleting"
            @click="doDelete"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { itemsApi } from '@/api/items.api'
import type { Item } from '@/types/pos.types'
import { useTenantStore } from '@/stores/tenant.store'

const { t } = useI18n()
const $q = useQuasar()
const tenantStore = useTenantStore()

const items = ref<Item[]>([])
const isLoading = ref(false)
const search = ref('')
const deleteDialog = ref(false)
const isDeleting = ref(false)
const selectedItem = ref<Item | null>(null)

const columns = [
  { name: 'name', label: t('items.itemName'), field: 'name', sortable: true, align: 'left' as const },
  { name: 'price', label: t('items.price'), field: 'price', sortable: true, align: 'right' as const },
  { name: 'category', label: t('items.category'), field: 'category', sortable: true, align: 'left' as const },
  { name: 'sku', label: t('items.sku'), field: 'sku', align: 'left' as const },
  { name: 'isActive', label: t('items.status'), field: 'isActive', sortable: true, align: 'center' as const },
  { name: 'actions', label: '', field: 'actions', align: 'right' as const },
]

function formatPrice(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MMK' }).format(val)
}

async function loadItems() {
  isLoading.value = true
  try {
    const res = await itemsApi.list({ search: search.value || undefined })
    items.value = (res.data as unknown as { items: Item[] }).items ?? (res.data as unknown as Item[])
  } catch {
    $q.notify({ type: 'negative', message: t('common.error') })
  } finally {
    isLoading.value = false
  }
}

function onSearch() {
  loadItems()
}

function confirmDelete(item: Item) {
  selectedItem.value = item
  deleteDialog.value = true
}

async function doDelete() {
  if (!selectedItem.value) return
  isDeleting.value = true
  try {
    await itemsApi.delete(selectedItem.value.id)
    $q.notify({ type: 'positive', message: t('items.deletedSuccess') })
    deleteDialog.value = false
    await loadItems()
  } catch {
    $q.notify({ type: 'negative', message: t('common.error') })
  } finally {
    isDeleting.value = false
  }
}

onMounted(loadItems)
</script>
