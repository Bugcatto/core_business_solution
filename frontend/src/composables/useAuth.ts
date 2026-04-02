import { useAuthStore } from '@/stores/auth.store'
import { useTenantStore } from '@/stores/tenant.store'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

export function useAuth() {
  const authStore = useAuthStore()
  const tenantStore = useTenantStore()
  const router = useRouter()
  const $q = useQuasar()
  const { t } = useI18n()

  async function handleLogin(email: string, password: string) {
    try {
      await authStore.login(email, password)
      await redirectAfterLogin()
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? ''
      const authErrors: Record<string, string> = {
        'auth/invalid-credential':   t('auth.invalidCredentials'),
        'auth/wrong-password':        t('auth.invalidCredentials'),
        'auth/user-not-found':        t('auth.invalidCredentials'),
        'auth/invalid-email':         t('auth.invalidEmail'),
        'auth/user-disabled':         t('auth.accountDisabled'),
        'auth/too-many-requests':     t('auth.tooManyAttempts'),
      }
      const message = authErrors[code] ?? (err instanceof Error ? err.message : t('auth.loginError'))
      $q.notify({ type: 'negative', message })
    }
  }

  async function handleGoogleLogin() {
    try {
      await authStore.loginWithGoogle()
      await redirectAfterLogin()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('auth.loginError')
      $q.notify({ type: 'negative', message })
    }
  }

  async function handleLogout() {
    await authStore.logout()
    tenantStore.clearTenant()
    $q.notify({ type: 'positive', message: t('auth.logoutSuccess') })
    router.push('/login')
  }

  async function redirectAfterLogin() {
    // Hydrate tenant store before deciding where to send the user.
    // On fresh login, localStorage is empty so businessId is null until we fetch.
    if (!tenantStore.businessId) {
      await tenantStore.fetchTenant()
    }
    if (tenantStore.businessId) {
      await router.push('/dashboard')
    } else {
      await router.push('/onboarding')
    }
  }

  return {
    user: authStore.user,
    isAuthenticated: !!authStore.user,
    handleLogin,
    handleGoogleLogin,
    handleLogout,
  }
}
