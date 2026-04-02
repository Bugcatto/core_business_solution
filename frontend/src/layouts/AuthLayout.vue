<template>
  <q-layout view="lHh lpr lFf" class="auth-layout">
    <q-page-container>
      <q-page class="flex flex-center bg-grey-2">
        <div class="auth-container">
          <div class="flex flex-center q-mb-lg">
            <AppLogo size="lg" />
          </div>
          <router-view />
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import AppLogo from '@/components/shared/AppLogo.vue'
</script>

<style scoped>
.auth-layout {
  min-height: 100vh;
}

.auth-container {
  width: 100%;
  max-width: 480px;
  padding: 24px 16px;
}
</style>
