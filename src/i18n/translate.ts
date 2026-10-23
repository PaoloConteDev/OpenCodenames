import catalogData from './catalog.json';
import type { Language } from '../content/languages';

/** Italian source messages; tuple order is English, Spanish, German, French. */
export const catalog: Record<string, readonly string[]> = catalogData;
const index = { en: 0, es: 1, de: 2, fr: 3 } as const;
export function translate(language: Language, source: string, ...values: unknown[]): string {
  let text = source;
  if (language !== 'it') {
    const translated = catalog[source]?.[index[language]];
    if (translated !== undefined) text = translated;
    else {
      const trimmed = source.trim();
      const entry = catalog[trimmed]?.[index[language]];
      if (entry !== undefined && trimmed) text = source.replace(trimmed, () => entry);
    }
  }
  // One pass: user-supplied braces and replacement characters stay literal.
  return text.replace(/\{(\d+)\}/g, (token, n: string) =>
    Number(n) < values.length ? String(values[Number(n)] ?? '') : token,
  );
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Wire/history formats are explicit: UI templates can have adjacent parameters
// and must never become regular expressions for incoming network messages.
const systemTemplates = [
  'Turno squadra {0}.',
  'Tempo scaduto per la squadra {0}.',
  'Missione {0}. Inizia la squadra {1}.',
  'Stanza piena (massimo {0} dispositivi in questa modalità)',
  'Versioni app incompatibili: questo dispositivo usa {0}, l’altro {1}. Installate la stessa versione di Open Codenames su tutti i telefoni.',
  'Impossibile aprire i canali RFCOMM: {0}',
  'Ponte non supportato dal telefono: {0}',
  'ECO LOCALE: {0}',
  'ECO RICEVUTO: {0}',
  'ECO DALL’HOST: {0}',
];
const patterns = systemTemplates
  .sort((a, b) => b.length - a.length)
  .map((key) => ({
    key,
    pattern: new RegExp(
      '^' +
        key
          .split(/\{\d+\}/)
          .map(escape)
          .join('([\\s\\S]*?)') +
        '$',
    ),
  }));

/** Only system-owned messages go here; never card words, clues or nicknames. */
export function localizeMessage(language: Language, message: string): string {
  if (language === 'it' || !message) return message;
  if (catalog[message]) return translate(language, message);
  const diagnostic = /^(\d{1,2}:\d{2}:\d{2}(?:\s?[AP]M)?)\s{2}([\s\S]*)$/.exec(message);
  if (diagnostic) return `${diagnostic[1]}  ${localizeMessage(language, diagnostic[2]!)}`;
  const choice = /^([\s\S]* → )(rossa|blu|neutrale|assassino)$/.exec(message);
  if (choice)
    return (
      choice[1] +
      translate(
        language,
        { rossa: 'Rossa', blu: 'Blu', neutrale: 'Neutrale', assassino: 'Assassino' }[
          choice[2] as 'rossa' | 'blu' | 'neutrale' | 'assassino'
        ],
      )
    );
  for (const { key, pattern } of patterns) {
    const match = pattern.exec(message);
    if (!match) continue;
    const values = match.slice(1).map((value) => {
      if (key.includes('squadra') && (value === 'rossa' || value === 'blu'))
        return translate(language, value === 'rossa' ? 'Rossa' : 'Blu');
      if (key.startsWith('Versioni app incompatibili') && value === 'precedente o non riconosciuta')
        return translate(language, value);
      return value;
    });
    return translate(language, key, ...values);
  }
  const cause = /(?:Caused by:|Causa:)\s*([\s\S]*)$/.exec(message);
  return cause ? localizeMessage(language, cause[1]!) : message;
}

export function localizeHistory(language: Language, entry: string): string {
  // Clue entries consist entirely of player text and a number. A nickname may
  // coincide with a system message prefix, so never run message matching on it.
  if (/^[\s\S]+: [\s\S]+ · (?:[0-9]|∞)$/.test(entry)) return entry;
  return localizeMessage(language, entry);
}
