import client from './client'

export interface OwnedBusiness {
  id:               string
  name:             string
  businessType:     string
  status:           string
  subscriptionPlan: string
}

export interface PlatformProfile {
  platformOwnerId: string
  email:           string
  displayName:     string | null
  businesses:      OwnedBusiness[]
}

export const platformApi = {
  // Returns platform owner profile + all owned businesses
  getMe() {
    return client.get<PlatformProfile>('/platform/me')
  },
}
