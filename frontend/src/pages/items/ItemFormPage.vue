<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <q-btn flat round dense icon="arrow_back" :to="{ name: 'Items' }" class="q-mr-sm" />
      <div class="text-h5 text-weight-bold">
        {{ isEdit ? t('items.editItem') : t('items.addItem') }}
      </div>
    </div>

    <q-card flat bordered style="max-width: 600px">
      <q-card-section>
        <q-form @submit.prevent="onSubmit" class="q-gutter-md">
          <q-input
            v-model="form.name"
            :label="t('items.itemName')"
            outlined
            :rules="[required]"
            input-style="min-height: 44px"
          />

          <q-input
            v-model.number="form.price"
            :label="t('items.price')"
            outlined
            type="number"
            min="0"
            :rules="[required]"
            input-style="min-height: 44px"
          />

          <q-input
            v-model="form.category"
            :label="t('items.category')"
            outlined
            input-style="min-height: 44px"
          />

          <q-input
            v-model="form.sku"
            :label="t('items.sku')"
            outlined
            input-style="min-height: 44px"
          />

          <q-input
            v-model.number="form.stock"
            :label="t('items.stock')"
            outlined
            type="number"
            min="0"
            input-style="min-height: 44px"
          />

          <q-toggle
            v-model="form.isActive"
            :label="form.isActive ? t('items.active') : t('items.inactive')"
          />

          <div class="row justify-end q-gutter-sm q-mt-md">
            <q-btn flat :label="t('common.cancel')" :to="{ name: 'Items' }" style="min-height: 44px" />
            <q-btn
              type="submit"
              :label="t('items.saveItem')"
              color="primary"
              unelevated
              style="min-height: 44px; min-width: 120px"
              :loading="isSaving"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { itemsApi } from '@/api/items.api'

const props = defineProps<{ id?: string }>()

const { t } = useI18n()
const router = useRouter()
const $q = useQuasar()

const isEdit = computed(() => !!props.id)
const isSaving = ref(false)

const form = ref({
  name: '',
  price: 0,
  category: '',
  sku: '',
  stock: 0,
  isActive: true,
})

function required(val: string | number) {
  return (val !== '' && val !== null && val !== undefined) || t('common.required')
}

async function loadItem() {
  if (!props.id) return
  try {
    const res = await itemsApi.getById(props.id)
    const item = res.data as unknown as typeof form.value
    form.value = {
      name: item.name,
      price: item.price,
      category: item.category ?? '',
      sku: item.sku ?? '',
      stock: item.stock ?? 0,
      isActive: item.isActive ?? true,
    }
  } catch {
    $q.notify({ type: 'negative', message: t('common.error') })
  }
}

async function onSubmit() {
  isSaving.value = true
  try {
    if (isEdit.value && props.id) {
      await itemsApi.update(props.id, form.value)
    } else {
      await itemsApi.create(form.value)
    }
    $q.notify({ type: 'positive', message: t('items.savedSuccess') })
    router.push({ name: 'Items' })
  } catch {
    $q.notify({ type: 'negative', message: t('common.error') })
  } finally {
    isSaving.value = false
  }
}

onMounted(loadItem)
</script>
