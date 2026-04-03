import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { setupGuards } from './guards'

const routes: RouteRecordRaw[] = [
  // ── Auth routes ────────────────────────────────────────────────────────────
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'Login',
        component: () => import('@/pages/auth/LoginPage.vue'),
        meta: { requiresGuest: true },
      },
      {
        path: '/signup',
        name: 'Signup',
        component: () => import('@/pages/auth/SignupPage.vue'),
        meta: { requiresGuest: true },
      },
    ],
  },

  // ── Email verification (authenticated but unverified) ────────────────────
  {
    path: '/verify-email',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'VerifyEmail',
        component: () => import('@/pages/auth/VerifyEmailPage.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },

  // ── Accept invite (public, no auth) ───────────────────────────────────────
  {
    path: '/accept-invite/:token',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'AcceptInvite',
        component: () => import('@/pages/staff/AcceptInvitePage.vue'),
      },
    ],
  },
  {
    path: '/onboarding',
    component: () => import('@/layouts/AuthLayout.vue'),
    children: [
      {
        path: '',
        name: 'Onboarding',
        component: () => import('@/pages/onboarding/OnboardingPage.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },

  // ── Platform owner — my businesses ────────────────────────────────────────
  {
    path: '/owner',
    component: () => import('@/layouts/DashboardLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Owner',
        component: () => import('@/pages/owner/OwnerPage.vue'),
      },
    ],
  },

  // ── Dashboard routes ───────────────────────────────────────────────────────
  {
    path: '/',
    component: () => import('@/layouts/DashboardLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        redirect: '/dashboard',
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/pages/dashboard/DashboardPage.vue'),
      },
      {
        path: 'items',
        name: 'Items',
        component: () => import('@/pages/items/ItemsPage.vue'),
      },
      {
        path: 'items/new',
        name: 'ItemNew',
        component: () => import('@/pages/items/ItemFormPage.vue'),
      },
      {
        path: 'items/:id/edit',
        name: 'ItemEdit',
        component: () => import('@/pages/items/ItemFormPage.vue'),
        props: true,
      },
      {
        path: 'staff',
        name: 'Staff',
        component: () => import('@/pages/staff/StaffPage.vue'),
        meta: { permission: 'user.invite' },
      },
      {
        path: 'transactions',
        name: 'Transactions',
        component: () => import('@/pages/transactions/TransactionsPage.vue'),
      },
    ],
  },

  // ── POS route ──────────────────────────────────────────────────────────────
  {
    path: '/pos',
    component: () => import('@/layouts/POSLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'POS',
        component: () => import('@/pages/pos/POSPage.vue'),
      },
    ],
  },

  // ── Catch-all ──────────────────────────────────────────────────────────────
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

setupGuards(router)

export default router
