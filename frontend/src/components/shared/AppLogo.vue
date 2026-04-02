<template>
  <div class="app-logo flex items-center gap-sm" :class="`app-logo--${size}`">
    <q-icon name="point_of_sale" :size="iconSize" :color="inverted ? 'white' : 'primary'" />
    <span class="app-logo__name" :class="inverted ? 'text-white' : 'text-primary'">
      POS Platform
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    inverted?: boolean
  }>(),
  { size: 'md', inverted: false },
)

const iconSize = computed(() => {
  const map = { sm: '24px', md: '32px', lg: '48px' }
  return map[props.size]
})
</script>

<style scoped>
.app-logo {
  cursor: default;
  user-select: none;
}

.app-logo__name {
  font-weight: 700;
  letter-spacing: -0.02em;
}

.app-logo--sm .app-logo__name { font-size: 1rem; }
.app-logo--md .app-logo__name { font-size: 1.25rem; }
.app-logo--lg .app-logo__name { font-size: 1.75rem; }
</style>
