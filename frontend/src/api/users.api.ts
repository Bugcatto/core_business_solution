import client from './client'

export interface StaffUser {
  id: string
  email: string
  displayName: string | null
  role?: { id: string; name: string } | null
  isActive: boolean
  inviteStatus: string
  createdAt: string
}

export interface Role {
  id: string
  name: string
  code?: string
}

export interface InviteUserPayload {
  email: string
  roleId: string
  branchId: string
}

export interface InvitePreview {
  invitedEmail: string
  businessName: string
  branchName: string
}

export interface LinkPreview {
  confirmed: boolean
  currentBusinessName: string | null
  currentBranchName: string | null
  newBusinessName: string
  newBranchName: string
}

export const usersApi = {
  listUsers() {
    return client.get<StaffUser[]>('/users')
  },

  inviteUser(payload: InviteUserPayload) {
    return client.post<{ inviteToken: string }>('/users/invite', payload)
  },

  // New user: set password and activate account
  acceptInvite(token: string, password: string) {
    return client.post<{ email: string }>(`/users/accept-invite/${token}`, { password })
  },

  // Get invite details for display (public)
  getInvitePreview(token: string) {
    return client.get<InvitePreview>(`/users/accept-invite/${token}/preview`)
  },

  // Existing user: get confirmation info before linking
  getLinkPreview(token: string) {
    return client.get<LinkPreview>(`/users/accept-invite/${token}/link`)
  },

  // Existing user: confirm and complete linking
  confirmLink(token: string) {
    return client.post<{ email: string }>(`/users/accept-invite/${token}/link`)
  },

  deactivateUser(id: string) {
    return client.delete<void>(`/users/${id}`)
  },

  reactivateUser(id: string) {
    return client.post<{ inviteToken: string }>(`/users/${id}/reactivate`)
  },

  listRoles() {
    return client.get<Role[]>('/rbac/roles')
  },
}
