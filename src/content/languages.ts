export const languages = [
  { code: 'it', name: 'Italiano' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
] as const;
export type Language = (typeof languages)[number]['code'];
export const isLanguage = (value: unknown): value is Language =>
  languages.some((language) => language.code === value);
export const languageOrItalian = (value: unknown): Language => (isLanguage(value) ? value : 'it');

/** Primary OS locale only; regional variants share the same bundled language. */
export function languageFromLocale(value: unknown): Language {
  const primary = typeof value === 'string' ? value.trim().split(/[-_]/)[0]?.toLowerCase() : '';
  return isLanguage(primary) ? primary : 'en';
}
