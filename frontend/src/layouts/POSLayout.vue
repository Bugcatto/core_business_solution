<template>
  <q-layout view="hHh lpR fFf" class="pos-layout">
    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
// Intentionally minimal — POS is fullscreen with its own header built into POSPage
</script>

<style scoped>
.pos-layout {
  height: 100vh;
  overflow: hidden;
}
</style>
