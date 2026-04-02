<template>
  <q-card flat bordered class="q-pa-md">
    <!-- Progress bar -->
    <q-linear-progress
      :value="progress"
      color="primary"
      class="q-mb-md"
      style="height: 6px; border-radius: 3px"
    />

    <q-card-section class="text-center q-pb-sm">
      <div class="text-h6 text-weight-bold">{{ t('onboarding.title') }}</div>
      <div class="text-caption text-grey-6">
        {{ t(`onboarding.step${currentStep}`) }} ({{ currentStep }}/{{ totalSteps }})
      </div>
    </q-card-section>

    <!-- Step 1: Business name + industry -->
    <template v-if="currentStep === 1">
      <q-card-section class="q-gutter-md">
        <q-input
          v-model="form.businessName"
          :label="t('onboarding.businessName')"
          :hint="t('onboarding.businessNameHint')"
          outlined
          :rules="[required]"
          input-style="min-height: 44px"
        />

        <div class="text-subtitle2 q-mt-md">{{ t('onboarding.selectIndustry') }}</div>
        <div class="row q-gutter-sm">
          <q-card
            v-for="ind in industries"
            :key="ind.value"
            flat
            bordered
            clickable
            class="col industry-card q-pa-md text-center cursor-pointer"
            :class="{ 'industry-card--selected': form.industryType === ind.value }"
            style="min-width: 100px; min-height: 80px"
            @click="form.industryType = ind.value"
          >
            <div class="text-h5">{{ ind.emoji }}</div>
            <div class="text-caption">{{ t(ind.labelKey) }}</div>
          </q-card>
        </div>
      </q-card-section>
    </template>

    <!-- Step 2: Branch name -->
    <template v-if="currentStep === 2">
      <q-card-section>
        <q-input
          v-model="form.branchName"
          :label="t('onboarding.branchName')"
          :hint="t('onboarding.branchNameHint')"
          outlined
          :rules="[required]"
          input-style="min-height: 44px"
        />
      </q-card-section>
    </template>

    <!-- Step 3: Plan selection -->
    <template v-if="currentStep === 3">
      <q-card-section class="q-gutter-sm">
        <q-card
          v-for="plan in plans"
          :key="plan.value"
          flat
          bordered
          clickable
          class="plan-card q-pa-md q-mb-sm"
          :class="{ 'plan-card--selected': form.plan === plan.value }"
          @click="form.plan = plan.value"
        >
          <div class="row items-center justify-between">
            <div>
              <div class="text-subtitle1 text-weight-bold">{{ t(plan.labelKey) }}</div>
              <div class="text-caption text-grey-6">{{ t(plan.descKey) }}</div>
            </div>
            <q-radio :model-value="form.plan" :val="plan.value" @update:model-value="form.plan = $event" />
          </div>
        </q-card>
      </q-card-section>
    </template>

    <!-- Step 4: Add first item -->
    <template v-if="currentStep === 4">
      <q-card-section>
        <div class="text-subtitle2 q-mb-md">{{ t('onboarding.addFirstItem') }}</div>
        <div class="q-gutter-md">
          <q-input
            v-model="form.firstItemName"
            :label="t('onboarding.itemName')"
            outlined
            input-style="min-height: 44px"
          />
          <q-input
            v-model.number="form.firstItemPrice"
            :label="t('onboarding.itemPrice')"
            outlined
            type="number"
            input-style="min-height: 44px"
          />
        </div>
      </q-card-section>
    </template>

    <!-- Step 5: Done -->
    <template v-if="currentStep === 5">
      <q-card-section class="text-center q-py-xl">
        <q-icon name="check_circle" size="80px" color="positive" />
        <div class="text-h5 text-weight-bold q-mt-md">{{ t('onboarding.doneTitle') }}</div>
        <div class="text-grey-6 q-mt-sm">{{ t('onboarding.doneSubtitle') }}</div>
        <q-btn
          :label="t('onboarding.openTerminal')"
          color="primary"
          unelevated
          class="q-mt-xl"
          style="min-height: 48px; min-width: 200px"
          :to="{ name: 'POS' }"
        />
      </q-card-section>
    </template>

    <!-- Navigation buttons -->
    <q-card-actions v-if="currentStep < 5" align="between" class="q-px-md q-pb-md">
      <q-btn
        v-if="currentStep > 1"
        flat
        :label="t('onboarding.back')"
        style="min-height: 44px"
        @click="currentStep--"
      />
      <div v-else />

      <div class="row q-gutter-sm">
        <q-btn
          v-if="currentStep === 4"
          flat
          color="grey-7"
          :label="t('onboarding.skipItem')"
          style="min-height: 44px"
          @click="onSkipItem"
        />
        <q-btn
          :label="currentStep === 4 ? t('onboarding.finish') : t('onboarding.next')"
          color="primary"
          unelevated
          style="min-height: 44px; min-width: 100px"
          :loading="isSaving"
          :disable="!canProceed"
          @click="onNext"
        />
      </div>
    </q-card-actions>
  </q-card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { authApi } from '@/api/auth.api'
import { useTenantStore } from '@/stores/tenant.store'
import { useAuthStore } from '@/stores/auth.store'
import { useRouter } from 'vue-router'
import type { IndustryType, PlanType } from '@/types/tenant.types'

const { t } = useI18n()
const $q = useQuasar()
const tenantStore = useTenantStore()
const authStore = useAuthStore()
const router = useRouter()

const totalSteps = 5
const currentStep = ref(1)
const isSaving = ref(false)

const form = ref({
  businessName: '',
  industryType: '' as IndustryType | '',
  branchName: '',
  plan: 'free' as PlanType,
  firstItemName: '',
  firstItemPrice: 0,
})

const progress = computed(() => (currentStep.value - 1) / (totalSteps - 1))

const canProceed = computed(() => {
  if (currentStep.value === 1) return !!form.value.businessName && !!form.value.industryType
  if (currentStep.value === 2) return !!form.value.branchName
  return true
})

const industries = [
  { value: 'retail' as IndustryType, emoji: '🛒', labelKey: 'onboarding.industryRetail' },
  { value: 'restaurant' as IndustryType, emoji: '🍽️', labelKey: 'onboarding.industryRestaurant' },
  { value: 'school' as IndustryType, emoji: '🏫', labelKey: 'onboarding.industrySchool' },
  { value: 'pharmacy' as IndustryType, emoji: '💊', labelKey: 'onboarding.industryPharmacy' },
  { value: 'service' as IndustryType, emoji: '🔧', labelKey: 'onboarding.industryService' },
]

const plans = [
  { value: 'free' as PlanType, labelKey: 'onboarding.planFree', descKey: 'onboarding.planFreeDesc' },
  { value: 'starter' as PlanType, labelKey: 'onboarding.planStarter', descKey: 'onboarding.planStarterDesc' },
  { value: 'enterprise' as PlanType, labelKey: 'onboarding.planBusiness', descKey: 'onboarding.planBusinessDesc' },
]

function required(val: string) {
  return !!val || t('common.required')
}

async function onNext() {
  if (currentStep.value === 4) {
    await submitOnboarding()
  } else {
    currentStep.value++
  }
}

async function onSkipItem() {
  form.value.firstItemName = ''
  form.value.firstItemPrice = 0
  await submitOnboarding()
}

async function submitOnboarding() {
  isSaving.value = true
  try {
    const email = authStore.user?.email ?? ''

    // Step 1: Create business + owner user in DB
    const bizRes = await authApi.createBusiness({
      name: form.value.businessName,
      businessType: form.value.industryType as IndustryType,
      country: 'MM',
      currency: 'MMK',
      language: 'en',
      email,
    })
    const { businessId } = bizRes.data as unknown as { businessId: string; userId: string }

    // Step 2: Select plan → backend auto-provisions branch, roles, terminal
    const provRes = await authApi.selectPlan(form.value.plan)
    const { defaultBranchId, defaultTerminalId } = provRes.data as unknown as { provisioned: boolean; defaultBranchId: string; defaultTerminalId: string }

    // Persist to tenant store
    tenantStore.setTenant({
      businessId,
      businessName: form.value.businessName,
      branchId: defaultBranchId,
      branchName: form.value.branchName || 'Main Branch',
      industryType: form.value.industryType as IndustryType,
      plan: form.value.plan,
      terminalId: defaultTerminalId,
      isOwner: true,
    })

    currentStep.value = 5
  } catch (err: unknown) {
    const msg = (err as any)?.response?.data?.message ?? (err instanceof Error ? err.message : t('common.error'))
    $q.notify({ type: 'negative', message: msg })
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.industry-card {
  transition: border-color 0.2s, background-color 0.2s;
}

.industry-card--selected {
  border-color: var(--q-primary) !important;
  background-color: rgba(25, 118, 210, 0.08);
}

.plan-card {
  transition: border-color 0.2s;
}

.plan-card--selected {
  border-color: var(--q-primary) !important;
}
</style>
