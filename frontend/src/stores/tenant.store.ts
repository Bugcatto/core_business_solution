import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { IndustryType, PlanType } from '@/types/tenant.types'
import { authApi } from '@/api/auth.api'
import { platformApi } from '@/api/platform.api'
import type { OwnedBusiness } from '@/api/platform.api'

const STORAGE_KEY = 'pos_tenant'

interface TenantState {
  platformOwnerId: string | null
  ownedBusinesses: OwnedBusiness[]
  businessId: string | null
  branchId: string | null
  terminalId: string | null
  businessName: string | null
  branchName: string | null
  industryType: IndustryType | null
  plan: PlanType | null
  enabledModules: string[]
  permissions: string[]
  isOwner: boolean
}

function loadFromStorage(): Partial<TenantState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export const useTenantStore = defineStore('tenant', () => {
  const saved = loadFromStorage()

  const platformOwnerId = ref<string | null>(saved.platformOwnerId ?? null)
  const ownedBusinesses = ref<OwnedBusiness[]>(saved.ownedBusinesses ?? [])
  const businessId = ref<string | null>(saved.businessId ?? null)
  const branchId = ref<string | null>(saved.branchId ?? null)
  const terminalId = ref<string | null>(saved.terminalId ?? null)
  const businessName = ref<string | null>(saved.businessName ?? null)
  const branchName = ref<string | null>(saved.branchName ?? null)
  const industryType = ref<IndustryType | null>(saved.industryType ?? null)
  const plan = ref<PlanType | null>(saved.plan ?? null)
  const enabledModules = ref<string[]>(saved.enabledModules ?? [])
  const permissions = ref<string[]>(saved.permissions ?? [])
  const isOwner = ref<boolean>(saved.isOwner ?? false)

  // ── Persist to localStorage on any change ─────────────────────────────────
  function persist() {
    const state: TenantState = {
      platformOwnerId: platformOwnerId.value,
      ownedBusinesses: ownedBusinesses.value,
      businessId: businessId.value,
      branchId: branchId.value,
      terminalId: terminalId.value,
      businessName: businessName.value,
      branchName: branchName.value,
      industryType: industryType.value,
      plan: plan.value,
      enabledModules: enabledModules.value,
      permissions: permissions.value,
      isOwner: isOwner.value,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  watch(
    [platformOwnerId, ownedBusinesses, businessId, branchId, terminalId, businessName, branchName, industryType, plan, enabledModules, permissions, isOwner],
    persist,
    { deep: true },
  )

  // Derived
  const isPlatformOwner = computed(() => !!platformOwnerId.value)
  const isFreePlan = computed(() => !plan.value || plan.value === 'free')
  const hasMultipleBusinesses = computed(() => ownedBusinesses.value.length > 1)

  // ── Actions ────────────────────────────────────────────────────────────────
  function setTenant(data: Partial<TenantState>) {
    if (data.platformOwnerId !== undefined) platformOwnerId.value = data.platformOwnerId
    if (data.ownedBusinesses !== undefined) ownedBusinesses.value = data.ownedBusinesses
    if (data.businessId !== undefined) businessId.value = data.businessId
    if (data.branchId !== undefined) branchId.value = data.branchId
    if (data.terminalId !== undefined) terminalId.value = data.terminalId
    if (data.businessName !== undefined) businessName.value = data.businessName
    if (data.branchName !== undefined) branchName.value = data.branchName
    if (data.industryType !== undefined) industryType.value = data.industryType
    if (data.plan !== undefined) plan.value = data.plan
    if (data.enabledModules !== undefined) enabledModules.value = data.enabledModules
    if (data.permissions !== undefined) permissions.value = data.permissions
    if (data.isOwner !== undefined) isOwner.value = data.isOwner
  }

  function hasPermission(code: string): boolean {
    if (isOwner.value) return true
    return permissions.value.includes(code)
  }

  function clearTenant() {
    platformOwnerId.value = null
    ownedBusinesses.value = []
    businessId.value = null
    branchId.value = null
    terminalId.value = null
    businessName.value = null
    branchName.value = null
    industryType.value = null
    plan.value = null
    enabledModules.value = []
    permissions.value = []
    isOwner.value = false
    localStorage.removeItem(STORAGE_KEY)
  }

  // ── Hydrate from backend ────────────────────────────────────────────────────
  async function fetchTenant(): Promise<void> {
    // 1. Fetch platform owner profile + owned businesses
    try {
      const { data: platform } = await platformApi.getMe()
      setTenant({
        platformOwnerId: platform.platformOwnerId,
        ownedBusinesses: platform.businesses,
      })
    } catch {
      // Not a platform owner (staff member) or no account yet — continue to step 2
    }

    // 2. Fetch business-level context for the active business
    try {
      const { data } = await authApi.me()
      setTenant({
        businessId:   data.businessId,
        branchId:     data.branchId,
        businessName: data.businessName,
        industryType: data.businessType,
        plan:         data.plan,
        terminalId:   data.defaultTerminalId ?? undefined,
        permissions:  data.permissions ?? [],
        isOwner:      data.isOwner ?? false,
      })
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status !== 404) throw err
    }
  }

  return {
    platformOwnerId,
    ownedBusinesses,
    isPlatformOwner,
    isFreePlan,
    hasMultipleBusinesses,
    businessId,
    branchId,
    terminalId,
    businessName,
    branchName,
    industryType,
    plan,
    enabledModules,
    permissions,
    isOwner,
    setTenant,
    clearTenant,
    fetchTenant,
    hasPermission,
  }
})
