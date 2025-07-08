import React, { createContext, useState, useContext, useCallback, ReactNode, useEffect } from 'react';
import { translations, type Locale, type TranslationKey } from './locales';

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);
const LOCALE_STORAGE_KEY = 'pohi-ai-locale';

export const LocaleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const storedLocale = typeof window !== 'undefined' ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
    return (storedLocale === 'hu' || storedLocale === 'en' || storedLocale === 'de') ? storedLocale : 'hu';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    }
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
  };

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>): string => {
    let translation = translations[locale]?.[key] || translations['en']?.[key] || String(key); // Fallback: current -> English -> key
    if (params) {
      Object.keys(params).forEach(paramKey => {
        translation = translation.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(params[paramKey]));
      });
    }
    return translation;
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = (): LocaleContextType => {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};
