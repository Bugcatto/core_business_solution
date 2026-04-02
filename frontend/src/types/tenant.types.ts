export type IndustryType = 'retail' | 'restaurant' | 'school' | 'pharmacy' | 'service'

export type PlanType = 'free' | 'starter' | 'growth' | 'enterprise'

export interface Business {
  id: string
  name: string
  industryType: IndustryType
  plan: PlanType
  createdAt: string
}

export interface Branch {
  id: string
  businessId: string
  name: string
  address?: string
  phone?: string
  createdAt: string
}

export interface Terminal {
  id: string
  branchId: string
  name: string
  isActive: boolean
}

export interface OnboardingBusinessPayload {
  name: string
  businessType: IndustryType
  country: string
  currency: string
  language: string
  email: string
}

export interface OnboardingTypePayload {
  businessId: string
  industryType: IndustryType
}

export interface OnboardingPlanPayload {
  businessId: string
  plan: PlanType
}

export interface OnboardingProvisionPayload {
  businessId: string
  branchName: string
  firstItem?: {
    name: string
    price: number
  }
}
