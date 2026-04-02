<template>
  <q-card flat bordered class="q-pa-lg">
    <q-card-section class="text-center q-pb-sm">
      <div class="text-h5 text-weight-bold">{{ t('auth.createAccount') }}</div>
    </q-card-section>

    <q-card-section>
      <q-form @submit.prevent="onSubmit" class="q-gutter-md">
        <q-input
          v-model="email"
          :label="t('auth.email')"
          type="email"
          outlined
          dense
          :rules="[required]"
          input-style="min-height: 44px"
          autocomplete="email"
        />

        <q-input
          v-model="password"
          :label="t('auth.password')"
          :type="showPassword ? 'text' : 'password'"
          outlined
          dense
          :rules="[required, minLength]"
          input-style="min-height: 44px"
          autocomplete="new-password"
        >
          <template #append>
            <q-icon
              :name="showPassword ? 'visibility_off' : 'visibility'"
              class="cursor-pointer"
              @click="showPassword = !showPassword"
            />
          </template>
        </q-input>

        <q-input
          v-model="confirmPassword"
          :label="t('auth.confirmPassword')"
          :type="showConfirmPassword ? 'text' : 'password'"
          outlined
          dense
          :rules="[required, passwordsMatch]"
          input-style="min-height: 44px"
          autocomplete="new-password"
        >
          <template #append>
            <q-icon
              :name="showConfirmPassword ? 'visibility_off' : 'visibility'"
              class="cursor-pointer"
              @click="showConfirmPassword = !showConfirmPassword"
            />
          </template>
        </q-input>

        <q-btn
          type="submit"
          :label="t('auth.createAccount')"
          color="primary"
          unelevated
          class="full-width"
          style="min-height: 48px"
          :loading="isLoading"
        />
      </q-form>
    </q-card-section>

    <q-separator />

    <q-card-section class="text-center q-pt-md">
      <span class="text-grey-6">{{ t('auth.alreadyHaveAccount') }} </span>
      <router-link to="/login" class="text-primary">{{ t('auth.signIn') }}</router-link>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const { t } = useI18n()
const $q = useQuasar()
const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const isLoading = ref(false)

function required(val: string) {
  return !!val || t('common.required')
}

function minLength(val: string) {
  return val.length >= 8 || t('auth.passwordTooShort')
}

function passwordsMatch(val: string) {
  return val === password.value || t('auth.passwordMismatch')
}

async function onSubmit() {
  isLoading.value = true
  try {
    await authStore.signup(email.value, password.value)
    await router.push('/verify-email')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : t('common.error')
    $q.notify({ type: 'negative', message })
  } finally {
    isLoading.value = false
  }
}
</script>
