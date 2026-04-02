<template>
  <q-page padding>
    <div class="row items-center justify-between q-mb-lg">
      <div>
        <div class="text-h5 text-weight-bold">{{ t('owner.myBusinesses') }}</div>
        <div class="text-caption text-grey-6">{{ t('owner.subtitle') }}</div>
      </div>
    </div>

    <!-- Business cards -->
    <div class="row q-col-gutter-md">
      <div
        v-for="business in tenantStore.ownedBusinesses"
        :key="business.id"
        class="col-12 col-sm-6 col-md-4"
      >
        <q-card flat bordered class="business-card">
          <q-card-section>
            <div class="row items-start justify-between no-wrap">
              <div class="col">
                <div class="text-subtitle1 text-weight-bold ellipsis">{{ business.name }}</div>
                <div class="text-caption text-grey-6 q-mt-xs">
                  {{ t(`onboarding.industry${capitalize(business.businessType)}`) }}
                </div>
              </div>
              <q-badge
                :color="statusColor(business.status)"
                class="q-ml-sm"
                style="white-space: nowrap"
              >
                {{ business.status }}
              </q-badge>
            </div>

            <div class="row q-mt-md items-center">
              <q-icon name="workspace_premium" size="14px" class="q-mr-xs text-grey-6" />
              <span class="text-caption text-grey-6 text-uppercase">{{ business.subscriptionPlan }}</span>
            </div>
          </q-card-section>

          <q-separator />

          <q-card-actions>
            <q-btn
              flat
              color="primary"
              :label="t('owner.enterBusiness')"
              icon-right="arrow_forward"
              style="min-height: 40px"
              @click="enterBusiness(business)"
            />
          </q-card-actions>
        </q-card>
      </div>

      <!-- Empty state -->
      <div v-if="tenantStore.ownedBusinesses.length === 0" class="col-12 text-center q-pa-xl text-grey-5">
        <q-icon name="business" size="64px" class="q-mb-md" />
        <div class="text-h6">{{ t('owner.noBusinesses') }}</div>
        <div class="text-body2 q-mt-sm">{{ t('owner.noBusinessesHint') }}</div>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useTenantStore } from '@/stores/tenant.store'
import { authApi } from '@/api/auth.api'
import type { OwnedBusiness } from '@/api/platform.api'

const { t } = useI18n()
const router = useRouter()
const tenantStore = useTenantStore()

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function statusColor(status: string) {
  const map: Record<string, string> = {
    active:     'positive',
    onboarding: 'warning',
    paused:     'grey',
    suspended:  'negative',
    archived:   'grey-7',
    closed:     'grey-9',
  }
  return map[status] ?? 'grey'
}

async function enterBusiness(business: OwnedBusiness) {
  // Set the selected business in store so X-Business-Id header is sent correctly
  tenantStore.setTenant({ businessId: business.id })

  // Hydrate full business context for the selected business
  try {
    const { data } = await authApi.me()
    tenantStore.setTenant({
      businessId:   data.businessId,
      branchId:     data.branchId,
      businessName: data.businessName,
      industryType: data.businessType,
      plan:         data.plan,
      terminalId:   data.defaultTerminalId ?? undefined,
      permissions:  data.permissions ?? [],
      isOwner:      data.isOwner ?? false,
    })
  } catch {
    // Context fetch failed — still navigate, guards will handle it
  }

  router.push('/dashboard')
}
</script>

<style scoped>
.business-card {
  transition: box-shadow 0.15s;
  min-height: 140px;
}
.business-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10);
}
</style>
