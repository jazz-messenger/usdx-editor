import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { translations } from './translations'
import type { Locale } from './translations'
import { LanguageContext } from './useLanguage'

const STORAGE_KEY = 'usdx-locale'

function detectLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'de' || stored === 'en') return stored
  const lang = navigator.language.slice(0, 2).toLowerCase()
  return lang === 'de' ? 'de' : 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale)

  const setLocale = (l: Locale) => {
    localStorage.setItem(STORAGE_KEY, l)
    setLocaleState(l)
  }

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t: translations[locale] }}>
      {children}
    </LanguageContext.Provider>
  )
}
