import { createContext, useContext } from 'react'
import { translations } from './translations'
import type { Locale, Translations } from './translations'

interface LanguageContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: Translations
}

export const LanguageContext = createContext<LanguageContextValue>({
  locale: 'de',
  setLocale: () => {},
  t: translations['de'],
})

export function useLanguage() {
  return useContext(LanguageContext)
}
