<template>
  <q-page class="flex flex-center">
    <q-card style="min-width: 380px; max-width: 480px; width: 100%">
      <q-card-section class="text-center q-pb-sm">
        <q-icon name="person_add" size="48px" color="primary" class="q-mb-sm" />
        <div class="text-h6">{{ t('staff.acceptInvite') }}</div>
        <div class="text-caption text-grey-6 q-mt-xs">{{ t('staff.acceptInviteSubtitle') }}</div>
      </q-card-section>

      <!-- Error state -->
      <q-card-section v-if="isError" class="text-center q-pb-lg">
        <q-icon name="error" size="48px" color="negative" class="q-mb-sm" />
        <div class="text-subtitle1 text-negative">{{ t('staff.inviteInvalid') }}</div>
        <div class="text-caption text-grey-6 q-mt-xs">{{ t('staff.inviteInvalidSubtitle') }}</div>
        <q-btn class="q-mt-md" :label="t('auth.login')" color="primary" unelevated :to="{ name: 'Login' }" />
      </q-card-section>

      <!-- Success state -->
      <q-card-section v-else-if="isDone" class="text-center q-pb-lg">
        <q-icon name="check_circle" size="48px" color="positive" class="q-mb-sm" />
        <div class="text-subtitle1 text-positive">{{ successMessage }}</div>
        <q-btn class="q-mt-lg" :label="t('auth.login')" color="primary" unelevated :to="{ name: 'Login' }" />
      </q-card-section>

      <!-- Link confirmation dialog -->
      <template v-else-if="showLinkConfirm && linkPreview">
        <q-card-section>
          <div class="text-subtitle2 text-weight-bold q-mb-md">{{ t('staff.linkConfirmTitle') }}</div>

          <div v-if="linkPreview.currentBusinessName" class="q-mb-sm">
            <div class="text-caption text-grey-6">{{ t('staff.linkCurrentlyAt') }}</div>
            <div class="text-body2 text-weight-medium">
              {{ linkPreview.currentBusinessName }}
              <span v-if="linkPreview.currentBranchName" class="text-grey-6">
                — {{ linkPreview.currentBranchName }}
              </span>
            </div>
          </div>

          <div>
            <div class="text-caption text-grey-6">{{ t('staff.linkWillJoin') }}</div>
            <div class="text-body2 text-weight-medium text-primary">
              {{ linkPreview.newBusinessName }}
              <span class="text-grey-6">— {{ linkPreview.newBranchName }}</span>
            </div>
          </div>
        </q-card-section>

        <q-card-actions class="q-px-md q-pb-md" align="right">
          <q-btn flat :label="t('common.cancel')" @click="showLinkConfirm = false" />
          <q-btn
            :label="t('staff.linkConfirm')"
            color="primary"
            unelevated
            :loading="isSubmitting"
            style="min-height: 44px"
            @click="doConfirmLink"
          />
        </q-card-actions>
      </template>

      <!-- Main tabs (loading or interactive) -->
      <template v-else-if="!isLoading">
        <q-tabs
          v-model="activeTab"
          dense
          align="justify"
          class="text-grey-7"
          active-color="primary"
          indicator-color="primary"
        >
          <q-tab name="create" :label="t('staff.createMyAccount')" />
          <q-tab name="existing" :label="t('staff.alreadyHaveAccountTab')" />
        </q-tabs>

        <q-separator />

        <!-- Tab: Create my account -->
        <q-tab-panels v-model="activeTab" animated>
          <q-tab-panel name="create" class="q-gutter-y-sm">
            <div class="text-caption text-grey-6 q-mb-xs">{{ t('auth.email') }}</div>
            <div class="text-body2 text-weight-medium q-mb-md">{{ invitedEmail }}</div>

            <q-input
              v-model="password"
              :label="t('staff.setPassword')"
              :type="showPwd ? 'text' : 'password'"
              outlined
              dense
            >
              <template #append>
                <q-icon
                  :name="showPwd ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="showPwd = !showPwd"
                />
              </template>
            </q-input>

            <q-input
              v-model="confirmPassword"
              :label="t('staff.confirmPasswordLabel')"
              :type="showPwd ? 'text' : 'password'"
              outlined
              dense
              :error="!!passwordError"
              :error-message="passwordError"
            />

            <q-btn
              :label="t('staff.setPassword')"
              color="primary"
              unelevated
              full-width
              style="min-height: 44px"
              :loading="isSubmitting"
              :disable="!password || !confirmPassword"
              @click="doCreateAccount"
            />
          </q-tab-panel>

          <!-- Tab: I already have an account -->
          <q-tab-panel name="existing" class="q-gutter-y-sm">
            <div class="text-caption text-grey-6 q-mb-md">{{ t('staff.loginThenLink') }}</div>

            <q-input
              v-model="existingEmail"
              :label="t('auth.email')"
              type="email"
              outlined
              dense
            />
            <q-input
              v-model="existingPassword"
              :label="t('auth.password')"
              :type="showExistingPwd ? 'text' : 'password'"
              outlined
              dense
            >
              <template #append>
                <q-icon
                  :name="showExistingPwd ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="showExistingPwd = !showExistingPwd"
                />
              </template>
            </q-input>

            <div v-if="loginError" class="text-negative text-caption">{{ loginError }}</div>

            <q-btn
              :label="t('auth.login')"
              color="primary"
              unelevated
              full-width
              style="min-height: 44px"
              :loading="isSubmitting"
              :disable="!existingEmail || !existingPassword"
              @click="doLoginAndPreview"
            />
          </q-tab-panel>
        </q-tab-panels>
      </template>

      <div v-else class="flex flex-center q-pa-xl">
        <q-spinner size="40px" color="primary" />
      </div>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/boot/firebase'
import { usersApi } from '@/api/users.api'
import type { LinkPreview } from '@/api/users.api'

const { t } = useI18n()
const $q = useQuasar()
const route = useRoute()

const token        = ref('')
const invitedEmail = ref('')
const activeTab    = ref<'create' | 'existing'>('create')
const isLoading    = ref(true)
const isSubmitting = ref(false)
const isDone       = ref(false)
const isError      = ref(false)
const successMessage = ref('')

// Create account tab
const password        = ref('')
const confirmPassword = ref('')
const showPwd         = ref(false)

const passwordError = computed(() => {
  if (confirmPassword.value && password.value !== confirmPassword.value) {
    return t('auth.passwordMismatch')
  }
  if (password.value && password.value.length < 8) {
    return t('auth.passwordTooShort')
  }
  return ''
})

// Existing account tab
const existingEmail    = ref('')
const existingPassword = ref('')
const showExistingPwd  = ref(false)
const loginError       = ref('')

// Link confirmation
const showLinkConfirm = ref(false)
const linkPreview     = ref<LinkPreview | null>(null)

onMounted(async () => {
  token.value = route.params.token as string
  if (!token.value) {
    isError.value = true
    isLoading.value = false
    return
  }
  try {
    const res = await usersApi.getInvitePreview(token.value)
    invitedEmail.value = res.data.invitedEmail
  } catch {
    isError.value = true
  } finally {
    isLoading.value = false
  }
})

async function doCreateAccount() {
  if (passwordError.value) {
    $q.notify({ type: 'warning', message: passwordError.value })
    return
  }
  isSubmitting.value = true
  try {
    await usersApi.acceptInvite(token.value, password.value)
    successMessage.value = t('staff.passwordSet')
    isDone.value = true
  } catch {
    $q.notify({ type: 'negative', message: t('staff.inviteInvalid') })
  } finally {
    isSubmitting.value = false
  }
}

async function doLoginAndPreview() {
  loginError.value = ''
  isSubmitting.value = true
  try {
    // Log the user in with their existing credentials
    await signInWithEmailAndPassword(auth, existingEmail.value, existingPassword.value)
    // Fetch the link confirmation info (requires auth — uses the logged-in token)
    const res = await usersApi.getLinkPreview(token.value)
    linkPreview.value = res.data
    showLinkConfirm.value = true
  } catch (err: any) {
    const code = err?.code ?? ''
    const errorMap: Record<string, string> = {
      'auth/invalid-credential': t('auth.invalidCredentials'),
      'auth/wrong-password':     t('auth.invalidCredentials'),
      'auth/user-not-found':     t('auth.invalidCredentials'),
      'auth/too-many-requests':  t('auth.tooManyAttempts'),
    }
    loginError.value = errorMap[code] ?? t('auth.loginError')
  } finally {
    isSubmitting.value = false
  }
}

async function doConfirmLink() {
  isSubmitting.value = true
  try {
    await usersApi.confirmLink(token.value)
    successMessage.value = t('staff.linkSuccess')
    showLinkConfirm.value = false
    isDone.value = true
  } catch {
    $q.notify({ type: 'negative', message: t('common.error') })
  } finally {
    isSubmitting.value = false
  }
}
</script>
