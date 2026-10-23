import React, { createContext, useContext, useMemo } from 'react';
import type { Language } from '../content/languages';
import { rules } from '../content/rules';
import { localizeHistory, localizeMessage, translate } from './translate';

const LanguageContext = createContext<Language>('it');
export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: React.ReactNode;
}) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}
export function useLanguage() {
  const language = useContext(LanguageContext);
  return useMemo(() => {
    const t = (source: string, ...values: unknown[]) => translate(language, source, ...values);
    return {
      language,
      t,
      message: (source: string) => localizeMessage(language, source),
      history: (source: string) => localizeHistory(language, source),
      labels: {
        red: t('Rossa'),
        blue: t('Blu'),
        neutral: t('Neutrale'),
        assassin: t('Assassino'),
        spy: t('Suggeritore'),
        guesser: t('Decifratore'),
        rules: rules[language],
      },
    };
  }, [language]);
}
