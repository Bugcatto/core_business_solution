import { computed } from 'vue'
import { useTenantStore } from '@/stores/tenant.store'
import { useI18n } from 'vue-i18n'

export function useIndustryConfig() {
  const tenant = useTenantStore()
  const { t } = useI18n()

  const showTableSelector = computed(() => tenant.industryType === 'restaurant')
  const showPrescriptionField = computed(() => tenant.industryType === 'pharmacy')
  const showStudentSearch = computed(() => tenant.industryType === 'school')

  const posLabel = computed(() =>
    tenant.industryType === 'restaurant'
      ? t('nav.items') // "Menu" equivalent
      : t('nav.items'),
  )

  const industryIcon = computed(() => {
    const icons: Record<string, string> = {
      retail: 'shopping_cart',
      restaurant: 'restaurant',
      school: 'school',
      pharmacy: 'local_pharmacy',
      service: 'build',
    }
    return icons[tenant.industryType ?? 'retail'] ?? 'store'
  })

  return {
    showTableSelector,
    showPrescriptionField,
    showStudentSearch,
    posLabel,
    industryIcon,
  }
}
