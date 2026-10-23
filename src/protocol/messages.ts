import { Action, ensure } from '../core/model';
import { version } from '../../package.json';
export const APP_VERSION = version;
export const PROTOCOL = 1;
export class VersionMismatchError extends Error {
  constructor(remote: unknown) {
    const label =
      typeof remote === 'string' && /^[\w.+-]{1,40}$/.test(remote)
        ? remote
        : 'precedente o non riconosciuta';
    super(
      `Versioni app incompatibili: questo dispositivo usa ${APP_VERSION}, l’altro ${label}. Installate la stessa versione di Open Codenames su tutti i telefoni.`,
    );
  }
}
export function envelope(message: object) {
  return { ...message, v: PROTOCOL, appVersion: APP_VERSION };
}
export const MAX_FRAME_BYTES = 32768;
export type Credentials = { gameId: string; playerId: string; token: string };
export type Hello = {
  v: 1;
  type: 'hello';
  nickname: string;
  roomCode: string;
  resume?: Credentials;
};
export type Command = {
  v: 1;
  type: 'command';
  gameId: string;
  id: string;
  version: number;
  action: Action;
};
export type Receipt = { id: string; ok: boolean; version: number; error?: string };
export function object(value: unknown): Record<string, unknown> {
  ensure(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    'Messaggio non valido',
  );
  return value as Record<string, unknown>;
}
export function string(value: unknown, max = 128): string {
  ensure(typeof value === 'string' && value.length > 0 && value.length <= max, 'Testo non valido');
  return value;
}
export function id(value: unknown): string {
  const s = string(value, 64);
  ensure(/^[a-f0-9]{64}$/.test(s), 'Identificatore non valido');
  return s;
}
export function nickname(value: unknown): string {
  const s = string(value, 20).normalize('NFC').trim();
  ensure(
    /^[\p{L}\p{N}][\p{L}\p{N} ._-]{0,19}$/u.test(s),
    'Nickname: 1–20 lettere o numeri, spazi, punto, trattino o underscore',
  );
  return s;
}
export function parse(text: string): Record<string, unknown> {
  ensure(text.length <= MAX_FRAME_BYTES, 'Messaggio troppo grande');
  const m = object(JSON.parse(text));
  if (m.appVersion !== APP_VERSION) throw new VersionMismatchError(m.appVersion);
  ensure(m.v === PROTOCOL, 'Versione protocollo incompatibile');
  return m;
}
export function hello(m: Record<string, unknown>): Hello {
  ensure(m.type === 'hello', 'Richiesta ingresso non valida');
  const code = typeof m.roomCode === 'string' ? m.roomCode : '';
  ensure(
    code.length <= 6 && (code === '' || /^[A-F0-9]{6}$/i.test(code)),
    'Codice stanza non valido',
  );
  const out: Hello = {
    v: 1,
    type: 'hello',
    nickname: nickname(m.nickname),
    roomCode: code.toUpperCase(),
  };
  if (m.resume !== undefined) {
    const r = object(m.resume);
    out.resume = { gameId: id(r.gameId), playerId: id(r.playerId), token: id(r.token) };
  }
  return out;
}
export function command(m: Record<string, unknown>): Command {
  ensure(m.type === 'command', 'Comando non valido');
  ensure(Number.isSafeInteger(m.version) && Number(m.version) >= 0, 'Versione stato non valida');
  const a = object(m.action);
  let action: Action;
  switch (a.type) {
    case 'choose':
      ensure(a.team === 'red' || a.team === 'blue', 'Squadra non valida');
      ensure(a.role === 'spy' || a.role === 'guesser', 'Ruolo non valido');
      action = { type: a.type, team: a.team, role: a.role };
      break;
    case 'ready':
      ensure(typeof a.ready === 'boolean', 'Disponibilità non valida');
      action = { type: a.type, ready: a.ready };
      break;
    case 'clue':
      ensure(
        a.count === 'infinity' ||
          (Number.isInteger(a.count) && Number(a.count) >= 0 && Number(a.count) <= 9),
        'Numero indizio non valido',
      );
      action = { type: a.type, word: string(a.word, 32), count: a.count as number | 'infinity' };
      break;
    case 'guess':
      ensure(
        Number.isInteger(a.index) && Number(a.index) >= 0 && Number(a.index) < 25,
        'Carta non valida',
      );
      action = { type: a.type, index: Number(a.index) };
      break;
    case 'remove':
      action = { type: a.type, playerId: id(a.playerId) };
      break;
    case 'probe':
      action = { type: a.type, text: string(a.text, 80) };
      break;
    case 'handoff':
      ensure(Number.isSafeInteger(a.turn) && Number(a.turn) > 0, 'Turno del passaggio non valido');
      ensure(
        a.phase === undefined || a.phase === 'clue' || a.phase === 'guess',
        'Fase del passaggio non valida',
      );
      action = { type: 'handoff', turn: Number(a.turn), ...(a.phase ? { phase: a.phase } : {}) };
      break;
    case 'start':
    case 'shuffle':
    case 'end':
    case 'cancel':
    case 'lobby':
    case 'sync':
      action = { type: a.type };
      break;
    default:
      throw new Error('Comando sconosciuto');
  }
  return {
    v: 1,
    type: 'command',
    gameId: id(m.gameId),
    id: id(m.id),
    version: Number(m.version),
    action,
  };
}
