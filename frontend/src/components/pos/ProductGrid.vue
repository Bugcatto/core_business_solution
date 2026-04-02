<template>
  <div class="product-grid-wrapper column no-wrap full-height">
    <!-- Search + category tabs -->
    <div class="q-px-md q-pt-md q-pb-sm">
      <q-input
        v-model="search"
        :placeholder="t('pos.searchProducts')"
        outlined
        dense
        clearable
        @update:model-value="filterItems"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>
    </div>

    <q-tabs
      v-model="activeCategory"
      dense
      align="left"
      class="q-px-md text-grey-7"
      active-color="primary"
      indicator-color="primary"
      @update:model-value="filterItems"
    >
      <q-tab :name="''" :label="t('pos.allCategories')" />
      <q-tab v-for="cat in categories" :key="cat" :name="cat" :label="cat" />
    </q-tabs>

    <q-separator />

    <!-- Product tiles -->
    <div class="product-grid-scroll col">
      <q-inner-loading :showing="isLoading">
        <q-spinner size="40px" color="primary" />
      </q-inner-loading>

      <div v-if="loadError" class="flex flex-center full-height text-negative">
        <div class="text-center q-pa-md">
          <q-icon name="lock" size="48px" class="q-mb-sm" />
          <div>{{ loadError }}</div>
        </div>
      </div>

      <div v-else-if="!isLoading && filteredItems.length === 0" class="flex flex-center full-height text-grey-5">
        <div class="text-center">
          <q-icon name="search_off" size="48px" />
          <div class="q-mt-sm">{{ t('common.noResults') }}</div>
        </div>
      </div>

      <div class="product-tiles q-pa-md">
        <q-card
          v-for="item in filteredItems"
          :key="item.id"
          flat
          bordered
          clickable
          class="product-tile cursor-pointer"
          @click="$emit('select', item)"
        >
          <q-card-section class="q-pa-sm text-center">
            <q-icon name="inventory_2" size="32px" color="grey-5" class="q-mb-xs" />
            <div class="product-tile__name text-weight-medium ellipsis-2-lines">{{ item.name }}</div>
            <div class="product-tile__price text-primary text-weight-bold q-mt-xs">
              {{ formatPrice(item.price) }}
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { itemsApi } from '@/api/items.api'
import type { Item } from '@/types/pos.types'

defineEmits<{ select: [item: Item] }>()

const { t } = useI18n()

const allItems = ref<Item[]>([])
const search = ref('')
const activeCategory = ref('')
const isLoading = ref(false)
const loadError = ref<string | null>(null)

const categories = computed(() => {
  const cats = new Set<string>()
  allItems.value.forEach((i) => { if (i.category) cats.add(i.category) })
  return [...cats].sort()
})

const filteredItems = computed(() => {
  return allItems.value.filter((item) => {
    const matchSearch = !search.value ||
      item.name.toLowerCase().includes(search.value.toLowerCase())
    const matchCategory = !activeCategory.value || item.category === activeCategory.value
    return matchSearch && matchCategory && item.isActive
  })
})

function filterItems() {
  // reactivity is handled by computed — this is a hook for future debounce/API search
}

function formatPrice(val: number) {
  return `${val.toLocaleString()} MMK`
}

async function loadItems() {
  isLoading.value = true
  loadError.value = null
  try {
    const res = await itemsApi.list({ pageSize: 200 })
    const data = res.data as unknown as { items?: Item[] } | Item[]
    allItems.value = Array.isArray(data) ? data : (data.items ?? [])
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 403) {
      loadError.value = t('pos.noItemsPermission')
    } else {
      loadError.value = t('pos.itemsLoadError')
    }
  } finally {
    isLoading.value = false
  }
}

onMounted(loadItems)
</script>

<style scoped>
.product-grid-wrapper {
  overflow: hidden;
}

.product-grid-scroll {
  overflow-y: auto;
  position: relative;
}

.product-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.product-tile {
  min-height: 100px;
  transition: box-shadow 0.15s;
}

.product-tile:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.product-tile__name {
  font-size: 0.8rem;
  line-height: 1.2;
  min-height: 2.4em;
}

.product-tile__price {
  font-size: 0.85rem;
}
</style>
