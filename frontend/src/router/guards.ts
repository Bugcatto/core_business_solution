import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useTenantStore } from '@/stores/tenant.store'

export function setupGuards(router: Router) {
  router.beforeEach(async (to) => {
    const authStore = useAuthStore()
    const tenantStore = useTenantStore()

    if (!authStore.isInitialized) {
      await authStore.init()
    }

    const isAuthenticated = !!authStore.user

    // Hydrate tenant context on cold load
    if (isAuthenticated && !tenantStore.businessId && !tenantStore.platformOwnerId) {
      try {
        await tenantStore.fetchTenant()
      } catch {
        // Network/5xx — fall through, guards handle unauthenticated state
      }
    }

    const hasBusinessSetup      = !!tenantStore.businessId
    const isPlatformOwner       = tenantStore.isPlatformOwner
    const hasMultipleBusinesses = tenantStore.hasMultipleBusinesses
    const emailVerified         = authStore.emailVerified

    // ── Email verification gate ────────────────────────────────────────────
    // Applies only to self-registered users heading to onboarding or the app.
    // Staff who accepted invites already have a businessId and never hit /onboarding.
    const bypassVerifyCheck =
      to.name === 'VerifyEmail' ||
      to.name === 'Login'       ||
      to.name === 'Signup'      ||
      to.name === 'AcceptInvite'

    if (isAuthenticated && !emailVerified && !bypassVerifyCheck) {
      // If they already have a business (e.g. Google login), let them through —
      // their email is verified via Google. Only block email/password signups.
      if (!hasBusinessSetup) {
        return '/verify-email'
      }
    }

    // ── Guest-only routes (login/signup) ──────────────────────────────────
    if (to.meta.requiresGuest && isAuthenticated) {
      if (!hasBusinessSetup) {
        return emailVerified ? '/onboarding' : '/verify-email'
      }
      if (isPlatformOwner && hasMultipleBusinesses) return '/owner'
      return '/dashboard'
    }

    // ── Onboarding — skip if already set up ───────────────────────────────
    if (to.name === 'Onboarding' && isAuthenticated && hasBusinessSetup) {
      return '/dashboard'
    }

    // ── Protected routes ───────────────────────────────────────────────────
    if (to.meta.requiresAuth && !isAuthenticated) {
      return '/login'
    }

    // ── No business set up yet — force onboarding ─────────────────────────
    if (
      isAuthenticated &&
      !hasBusinessSetup &&
      to.name !== 'Onboarding' &&
      to.name !== 'Owner'      &&
      to.name !== 'VerifyEmail'
    ) {
      return emailVerified ? '/onboarding' : '/verify-email'
    }

    return true
  })
}
