import { createI18n } from 'vue-i18n'
import en from '@/i18n/en'
import my from '@/i18n/my'

export type MessageSchema = typeof en

const savedLocale = localStorage.getItem('locale') ?? 'en'

const i18n = createI18n<[MessageSchema], 'en' | 'my'>({
  legacy: false,
  locale: savedLocale as 'en' | 'my',
  fallbackLocale: 'en',
  messages: {
    en,
    my,
  },
})

export default i18n
