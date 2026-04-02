import client from './client'
import type {
  IndustryType,
  PlanType,
  OnboardingBusinessPayload,
  OnboardingPlanPayload,
} from '@/types/tenant.types'

export interface MeResponse {
  businessId:        string
  branchId:          string
  businessName:      string
  businessType:      IndustryType
  plan:              PlanType
  defaultTerminalId: string | null
  permissions:       string[]
  isOwner:           boolean
}

export const authApi = {
  // Fetch the current user's tenant context (used on every cold page load)
  me() {
    return client.get<MeResponse>('/users/me')
  },

  // Step 1: Create business (includes businessType, email, country, currency)
  createBusiness(payload: OnboardingBusinessPayload) {
    return client.post<{ businessId: string; userId: string }>('/onboarding/business', payload)
  },

  // Step 2: Select plan — backend auto-provisions branch + roles + terminal
  selectPlan(plan: OnboardingPlanPayload['plan']) {
    return client.post<{ provisioned: boolean; defaultBranchId: string }>(
      '/onboarding/plan',
      { plan },
    )
  },
}
