<template>
  <q-card flat bordered class="q-pa-lg text-center">
    <q-card-section class="q-pb-sm">
      <q-icon name="mark_email_unread" size="64px" color="primary" class="q-mb-md" />
      <div class="text-h5 text-weight-bold">{{ t('auth.verifyEmailTitle') }}</div>
      <div class="text-body2 text-grey-6 q-mt-sm">
        {{ t('auth.verifyEmailSubtitle') }}
        <strong v-if="authStore.user?.email">{{ authStore.user.email }}</strong>
      </div>
    </q-card-section>

    <q-card-section class="q-gutter-y-sm">
      <q-btn
        :label="t('auth.iVerified')"
        color="primary"
        unelevated
        class="full-width"
        style="min-height: 48px"
        :loading="isChecking"
        @click="checkVerification"
      />
      <q-btn
        :label="t('auth.resendEmail')"
        flat
        color="grey-7"
        class="full-width"
        style="min-height: 44px"
        :loading="isResending"
        :disable="resendCooldown > 0"
        @click="resend"
      >
        <template v-if="resendCooldown > 0" #default>
          {{ t('auth.resendEmail') }} ({{ resendCooldown }}s)
        </template>
      </q-btn>
    </q-card-section>

    <q-separator class="q-my-sm" />

    <q-card-section class="q-pt-sm q-pb-xs">
      <span class="text-caption text-grey-6">{{ t('auth.wrongAccount') }} </span>
      <a class="text-primary text-caption cursor-pointer" @click="handleLogout">{{ t('nav.logout') }}</a>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useTenantStore } from '@/stores/tenant.store'
import { useAuth } from '@/composables/useAuth'

const { t } = useI18n()
const $q = useQuasar()
const router = useRouter()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const { handleLogout } = useAuth()

const isChecking = ref(false)
const isResending = ref(false)
const resendCooldown = ref(0)

let cooldownTimer: ReturnType<typeof setInterval> | null = null

async function checkVerification() {
  isChecking.value = true
  try {
    await authStore.reloadUser()
    if (authStore.emailVerified) {
      // Proceed: go to onboarding (new user) or dashboard (returning user)
      if (tenantStore.businessId) {
        router.push('/dashboard')
      } else {
        router.push('/onboarding')
      }
    } else {
      $q.notify({ type: 'warning', message: t('auth.notVerifiedYet') })
    }
  } finally {
    isChecking.value = false
  }
}

async function resend() {
  isResending.value = true
  try {
    await authStore.resendVerificationEmail()
    $q.notify({ type: 'positive', message: t('auth.verificationResent') })
    startCooldown()
  } catch {
    $q.notify({ type: 'negative', message: t('common.error') })
  } finally {
    isResending.value = false
  }
}

function startCooldown() {
  resendCooldown.value = 60
  cooldownTimer = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0 && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})
</script>
