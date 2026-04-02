import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  getIdToken,
  sendEmailVerification,
  type User,
} from 'firebase/auth'
import { auth } from '@/boot/firebase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const idToken = ref<string | null>(null)
  const isInitialized = ref(false)

  const emailVerified = computed(() => user.value?.emailVerified ?? false)

  // Cached promise so concurrent guard calls share a single onAuthStateChanged listener
  let _initPromise: Promise<void> | null = null

  // ── Bootstrap: watch Firebase auth state ──────────────────────────────────
  function init() {
    // Return the in-flight or already-resolved promise so concurrent guard
    // calls never register a second listener.
    if (_initPromise) return _initPromise

    _initPromise = (async () => {
      // authStateReady() (Firebase SDK ≥ 10.1) resolves only after Firebase has
      // fully read from IndexedDB/localStorage and determined the initial auth
      // state. This is more reliable than waiting for the first onAuthStateChanged
      // callback, which can fire with null before persistence lookup completes.
      if (typeof (auth as unknown as { authStateReady(): Promise<void> }).authStateReady === 'function') {
        await (auth as unknown as { authStateReady(): Promise<void> }).authStateReady()
      } else {
        // Fallback: first onAuthStateChanged call — unsubscribe immediately after.
        await new Promise<void>((resolve) => {
          const unsub = onAuthStateChanged(auth, () => { unsub(); resolve() })
        })
      }

      // After authStateReady / first callback, auth.currentUser is definitive.
      const firebaseUser = auth.currentUser
      user.value = firebaseUser
      idToken.value = firebaseUser ? await getIdToken(firebaseUser) : null
      isInitialized.value = true

      // Persistent listener for subsequent changes (logout, token refresh, etc.)
      onAuthStateChanged(auth, async (updated) => {
        user.value = updated
        idToken.value = updated ? await getIdToken(updated) : null
      })
    })()

    return _initPromise
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function login(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(auth, email, password)
    user.value = credential.user
    idToken.value = await getIdToken(credential.user)
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    const credential = await signInWithPopup(auth, provider)
    user.value = credential.user
    idToken.value = await getIdToken(credential.user)
  }

  async function logout() {
    await signOut(auth)
    user.value = null
    idToken.value = null
  }

  async function signup(email: string, password: string) {
    const { createUserWithEmailAndPassword } = await import('firebase/auth')
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    user.value = credential.user
    idToken.value = await getIdToken(credential.user)
    // Send verification email — user must verify before proceeding to onboarding
    await sendEmailVerification(credential.user)
  }

  // Call after the user clicks "I verified" — reloads Firebase state to pick up emailVerified = true
  async function reloadUser() {
    if (!user.value) return
    await user.value.reload()
    // Refresh our local copy and the id token (emailVerified is now baked into the token)
    user.value = auth.currentUser
    idToken.value = user.value ? await getIdToken(user.value, true) : null
  }

  async function resendVerificationEmail() {
    if (!user.value) return
    await sendEmailVerification(user.value)
  }

  async function refreshToken() {
    if (!user.value) throw new Error('No authenticated user')
    idToken.value = await getIdToken(user.value, true)
    return idToken.value
  }

  return {
    user,
    idToken,
    isInitialized,
    emailVerified,
    init,
    login,
    loginWithGoogle,
    logout,
    signup,
    reloadUser,
    resendVerificationEmail,
    refreshToken,
  }
})
