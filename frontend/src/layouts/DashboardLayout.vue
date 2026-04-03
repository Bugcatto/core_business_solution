<template>
  <q-layout view="lHh Lpr lFf">
    <!-- Header -->
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          :aria-label="t('nav.dashboard')"
          @click="toggleDrawer"
        />
        <q-toolbar-title>
          <AppLogo size="sm" inverted />
        </q-toolbar-title>

        <q-btn
          flat
          round
          dense
          icon="point_of_sale"
          :to="{ name: 'POS' }"
          :title="t('nav.pos')"
        />

        <q-btn flat round dense icon="person">
          <q-menu>
            <q-list style="min-width: 160px">
              <q-item>
                <q-item-section>
                  <q-item-label caption>{{ authStore.user?.email }}</q-item-label>
                  <q-item-label>{{ tenantStore.businessName }}</q-item-label>
                </q-item-section>
              </q-item>
              <q-separator />
              <q-item clickable v-close-popup @click="handleLogout">
                <q-item-section avatar>
                  <q-icon name="logout" />
                </q-item-section>
                <q-item-section>{{ t('nav.logout') }}</q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <!-- Sidebar drawer -->
    <q-drawer
      v-model="drawerOpen"
      show-if-above
      :width="240"
      :breakpoint="768"
      bordered
    >
      <q-scroll-area class="fit">
        <div class="q-pa-md q-pb-sm">
          <div class="text-caption text-grey-6">{{ tenantStore.branchName }}</div>
        </div>
        <q-list padding>
          <!-- Platform owner nav (My Businesses) -->
          <template v-if="tenantStore.isPlatformOwner">
            <q-item
              v-for="item in ownerNavItems"
              :key="item.name"
              clickable
              :active="isActive(item.to)"
              active-class="text-primary"
              :to="item.to"
              style="min-height: 48px"
            >
              <q-item-section avatar>
                <q-icon :name="item.icon" />
              </q-item-section>
              <q-item-section>{{ item.label }}</q-item-section>
            </q-item>
            <q-separator class="q-my-xs" />
          </template>

          <!-- Business nav -->
          <q-item
            v-for="item in visibleNavItems"
            :key="item.name"
            clickable
            :active="isActive(item.to)"
            active-class="text-primary"
            :to="item.to"
            style="min-height: 48px"
          >
            <q-item-section avatar>
              <q-icon :name="item.icon" />
            </q-item-section>
            <q-item-section>{{ item.label }}</q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>
    </q-drawer>

    <!-- Page content -->
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useTenantStore } from '@/stores/tenant.store'
import { useAuth } from '@/composables/useAuth'
import AppLogo from '@/components/shared/AppLogo.vue'

const { t } = useI18n()
const route = useRoute()
const authStore = useAuthStore()
const tenantStore = useTenantStore()
const { handleLogout } = useAuth()

const drawerOpen = ref(true)

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value
}

function isActive(path: string) {
  return route.path.startsWith(path)
}

const navItems = [
  { name: 'Dashboard', label: t('nav.dashboard'), icon: 'dashboard',     to: '/dashboard', permission: null,           module: null },
  { name: 'Items',     label: t('nav.items'),     icon: 'inventory_2',   to: '/items',     permission: null,           module: 'catalog' },
  { name: 'Staff',     label: t('nav.staff'),     icon: 'group',         to: '/staff',     permission: 'user.invite',  module: null },
  { name: 'POS',       label: t('nav.pos'),       icon: 'point_of_sale', to: '/pos',       permission: null,              module: 'pos' },
  { name: 'Transactions', label: 'Transactions',  icon: 'receipt_long',  to: '/transactions', permission: 'pos.sale.create', module: 'pos' },
]

// Platform owner nav — shown above the business nav when user is a platform owner
const ownerNavItems = [
  { name: 'Owner', label: t('nav.myBusinesses'), icon: 'business', to: '/owner' },
]

const visibleNavItems = computed(() =>
  navItems.filter((item) => {
    if (item.permission && !tenantStore.hasPermission(item.permission)) return false
    if (item.module && !tenantStore.isOwner && !tenantStore.enabledModules.includes(item.module)) return false
    return true
  })
)
</script>
