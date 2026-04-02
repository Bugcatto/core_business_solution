<template>
  <q-card flat bordered class="q-pa-lg">
    <q-card-section class="text-center q-pb-sm">
      <div class="text-h5 text-weight-bold">{{ t('auth.login') }}</div>
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
          :rules="[required]"
          input-style="min-height: 44px"
          autocomplete="current-password"
        >
          <template #append>
            <q-icon
              :name="showPassword ? 'visibility_off' : 'visibility'"
              class="cursor-pointer"
              @click="showPassword = !showPassword"
            />
          </template>
        </q-input>

        <q-btn
          type="submit"
          :label="t('auth.login')"
          color="primary"
          unelevated
          class="full-width"
          style="min-height: 48px"
          :loading="isLoading"
        />
      </q-form>
    </q-card-section>

    <q-separator />

    <q-card-section class="q-pt-md">
      <q-btn
        :label="t('auth.loginWithGoogle')"
        outline
        color="grey-8"
        class="full-width"
        style="min-height: 48px"
        icon="img:https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
        :loading="isGoogleLoading"
        @click="onGoogleLogin"
      />
    </q-card-section>

    <q-card-section class="text-center q-pt-none">
      <span class="text-grey-6">{{ t('auth.noAccount') }} </span>
      <router-link to="/signup" class="text-primary">{{ t('auth.signup') }}</router-link>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth'

const { t } = useI18n()
const { handleLogin, handleGoogleLogin } = useAuth()

const email = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)
const isGoogleLoading = ref(false)

function required(val: string) {
  return !!val || t('common.required')
}

async function onSubmit() {
  isLoading.value = true
  try {
    await handleLogin(email.value, password.value)
  } finally {
    isLoading.value = false
  }
}

async function onGoogleLogin() {
  isGoogleLoading.value = true
  try {
    await handleGoogleLogin()
  } finally {
    isGoogleLoading.value = false
  }
}
</script>
