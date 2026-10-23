import { describe, it, expect } from 'vitest';
import {
  languages,
  languageOrItalian,
  languageFromLocale,
  type Language,
} from '../src/content/languages';
import { wordLists } from '../src/content/words';
import { rules } from '../src/content/rules';
import { catalog, localizeHistory, localizeMessage, translate } from '../src/i18n/translate';
import { board, apply, newGame, project } from '../src/core/engine';
import { normalize, type Player } from '../src/core/model';
import { Authority, clone, type HostStore } from '../src/session/authority';

const random = (n: number) => Math.floor(Math.random() * n);
const host: Player = {
  id: 'host',
  nickname: 'Gioca {0} $&',
  team: 'red',
  role: 'guesser',
  ready: true,
  connected: true,
};
const placeholders = (text: string) => [...text.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort();

describe('lingue e contenuti offline', () => {
  it.each([
    ['it-IT', 'it'],
    ['en-GB', 'en'],
    ['en_US', 'en'],
    ['es-MX', 'es'],
    ['es-419', 'es'],
    ['de-CH', 'de'],
    ['fr-CA', 'fr'],
    ['FR_fr', 'fr'],
    ['pt-BR', 'en'],
    ['zh-Hant-TW', 'en'],
    ['', 'en'],
    [undefined, 'en'],
  ])('lingua di sistema %s → %s', (locale, expected) => {
    expect(languageFromLocale(locale)).toBe(expected);
  });
  it('traduce ogni messaggio in tutte le lingue conservando i parametri', () => {
    expect(Object.keys(catalog).length).toBeGreaterThan(450);
    for (const [source, values] of Object.entries(catalog)) {
      expect(values, source).toHaveLength(4);
      for (const value of values) {
        expect(value.trim(), source).not.toBe('');
        expect(placeholders(value), source).toEqual(placeholders(source));
      }
    }
  });
  it.each(languages)('$name ha un mazzo originale e tabelloni coerenti', ({ code }) => {
    const words = wordLists[code];
    expect(words.length).toBeGreaterThanOrEqual(500);
    expect(new Set(words.map(normalize)).size).toBe(words.length);
    words.forEach((word) => {
      expect(word).toBe(word.normalize('NFC'));
      expect(word).toMatch(/^\p{L}+(?:-\p{L}+)*$/u);
    });
    expect(rules[code].length).toBeGreaterThan(2000);
    for (let i = 0; i < 20; i++) {
      const b = board(random, code);
      expect(new Set(b.cards.map((card) => normalize(card.word))).size).toBe(25);
      expect(b.cards.every((card) => words.includes(card.word))).toBe(true);
      expect(b.cards.filter((card) => card.color === b.first)).toHaveLength(9);
      expect(b.cards.filter((card) => card.color === 'neutral')).toHaveLength(7);
      expect(b.cards.filter((card) => card.color === 'assassin')).toHaveLength(1);
    }
  });
  it('conserva parametri utente, spazi e messaggi tecnici sconosciuti', () => {
    expect(translate('en', 'Rimuovi {0}', 'Gioca {1} $&')).toBe('Remove Gioca {1} $&');
    expect(translate('fr', 'Versione ')).toBe('Version ');
    expect(translate('de', 'Open Codenames')).toBe('Open Codenames');
    expect(localizeMessage('es', 'ECONNRESET')).toBe('ECONNRESET');
    expect(localizeMessage('it', 'Turno squadra rossa.')).toBe('Turno squadra rossa.');
    expect(languageOrItalian('xx')).toBe('it');
    expect(languageOrItalian(undefined)).toBe('it');
  });
  it('traduce messaggi dinamici e registro senza riscrivere nomi o parole', () => {
    expect(localizeHistory('fr', 'ECO LOCALE: Geheimnis · 2')).toBe('ECO LOCALE: Geheimnis · 2');
    expect(localizeMessage('en', 'Turno squadra rossa.')).toBe('Red team’s turn.');
    expect(localizeMessage('es', 'Missione 3. Inizia la squadra blu.')).toBe(
      'Misión 3. Empieza el equipo Azul.',
    );
    expect(localizeMessage('de', 'Gioca: château → rossa')).toBe('Gioca: château → Rot');
    expect(localizeMessage('fr', 'Gioca: Geheimnis · 2')).toBe('Gioca: Geheimnis · 2');
    expect(localizeMessage('en', 'Stanza piena (massimo 10 dispositivi in questa modalità)')).toBe(
      'Room full (maximum 10 devices in this mode)',
    );
    expect(localizeMessage('en', '12:10:05  Sessione sincronizzata')).toBe(
      '12:10:05  Session synchronised',
    );
  });
  it('la lingua del mazzo è proiettata e resta fissa tra turni e nuove missioni', () => {
    const game = newGame('game', host, null, 'single', 'fr');
    let started = apply(game, host.id, { type: 'start' }, random);
    expect(started.language).toBe('fr');
    const view = project(started, host.id);
    expect(view.language).toBe('fr');
    expect(view.board.every((card) => !('color' in card))).toBe(true);
    expect(view.board.every((card) => wordLists.fr.includes(card.word))).toBe(true);
    expect(view.players[0]!.nickname).toBe(host.nickname);
    started = apply(started, host.id, { type: 'cancel' }, random);
    started = apply(started, host.id, { type: 'lobby' }, random);
    started = apply(started, host.id, { type: 'start' }, random);
    expect(started.language).toBe('fr');
    expect(started.board.every((card) => wordLists.fr.includes(card.word))).toBe(true);
    expect(() => newGame('bad', host, null, 'single', 'xx' as Language)).toThrow('Lingua');
  });
  it('recupera lingua e parole salvate e migra i vecchi salvataggi in italiano', async () => {
    const data = Authority.create(
      'Telefono',
      'local',
      () => 'abc',
      random,
      { save: async () => {} },
      null,
      'single',
      'de',
    );
    const store = clone(data.data);
    store.game = apply(store.game, store.game.hostId, { type: 'start' }, random);
    const restored = new Authority(store, { save: async () => {} }, () => 'abc', random);
    await restored.recover();
    expect(restored.view(store.game.hostId).language).toBe('de');
    expect(restored.data.game.board).toEqual(store.game.board);
    const legacy = clone(store) as HostStore;
    delete (legacy.game as Partial<typeof legacy.game>).language;
    const old = new Authority(legacy, { save: async () => {} }, () => 'abc', random);
    expect(old.data.game.language).toBe('it');
    expect(old.data.game.board).toEqual(store.game.board);
  });
  it('le maiuscole tedesche non aggirano il divieto di indizi uguali a carte coperte', () => {
    expect(normalize('Straße')).toBe(normalize('STRASSE'));
    expect(normalize('cœur')).toBe(normalize('COEUR'));
    expect(localizeMessage('fr', 'Turno squadra blu.')).toBe('Tour de l’équipe Bleue.');
    let game = apply(
      newGame('game', host, null, 'single', 'de'),
      host.id,
      { type: 'start' },
      random,
    );
    game = apply(game, host.id, { type: 'handoff', turn: game.turn, phase: 'clue' }, random);
    game.board[0]!.word = 'Straße';
    expect(() => apply(game, host.id, { type: 'clue', word: 'STRASSE', count: 1 }, random)).toThrow(
      'coperta',
    );
  });
});
