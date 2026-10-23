import sessionLimits from '../../config/session-limits.json';
import type { Language } from '../content/languages';

export type Team = 'red' | 'blue';
export type Role = 'spy' | 'guesser';
export type PlayStyle = 'classic' | 'shared' | 'single';
export type Color = Team | 'neutral' | 'assassin';
export type Player = {
  id: string;
  nickname: string;
  team: Team;
  role: Role;
  ready: boolean;
  connected: boolean;
  handoffTurn?: number;
  handoffPhase?: 'clue' | 'guess';
};
export type Card = { word: string; color: Color; revealed: boolean; selectedBy?: Team };
export type Clue = { word: string; count: number | 'infinity' };
export type Phase = 'lobby' | 'clue' | 'guess' | 'finished';
export type Game = {
  schema: 1;
  playStyle: PlayStyle;
  language: Language;
  turn: number;
  id: string;
  hostId: string;
  version: number;
  players: Player[];
  phase: Phase;
  board: Card[];
  active: Team;
  clue: Clue | null;
  guesses: number;
  remaining: number | null;
  winner: Team | null;
  reason: string | null;
  history: string[];
  round: number;
  turnSeconds: number | null;
  turnEndsAt: number | null;
};
export type Action =
  | { type: 'choose'; team: Team; role: Role }
  | { type: 'ready'; ready: boolean }
  | { type: 'shuffle' }
  | { type: 'start' }
  | { type: 'handoff'; turn: number; phase?: 'clue' | 'guess' }
  | { type: 'clue'; word: string; count: number | 'infinity' }
  | { type: 'guess'; index: number }
  | { type: 'end' }
  | { type: 'cancel' }
  | { type: 'lobby' }
  | { type: 'remove'; playerId: string }
  | { type: 'sync' }
  | { type: 'probe'; text: string };
export type PublicCard = { word: string; revealed: boolean; color?: Color; selectedBy?: Team };
export type View = Omit<Game, 'board' | 'hostId' | 'schema'> & {
  board: PublicCard[];
  hostId: string;
  paused: boolean;
  counters: Record<Team, number>;
};
export type RandomInt = (bound: number) => number;
export const MAX_PLAYERS = sessionLimits.maxPlayers;
export const TURN_SECONDS = [30, 60, 90, 120, 180] as const;
export const MAX_HISTORY = 100;
export const BLUETOOTH_DIRECT_MAX_PLAYERS = sessionLimits.bluetoothDirectMaxPlayers;
export const MAX_RELAY_CHILDREN = sessionLimits.relayMaxChildren;
export const playerLimit = (mode: 'bluetooth' | 'lan' | 'local') =>
  mode === 'local' ? 1 : MAX_PLAYERS;
export const other = (team: Team): Team => (team === 'red' ? 'blue' : 'red');
export const needsHandoff = (
  game: Pick<Game, 'playStyle' | 'phase' | 'turn'>,
  player: Pick<Player, 'handoffTurn' | 'handoffPhase'> | undefined,
) =>
  game.playStyle !== 'classic' &&
  (game.phase === 'clue' || game.phase === 'guess') &&
  (player?.handoffTurn !== game.turn ||
    (game.playStyle === 'single' && player?.handoffPhase !== game.phase));
export const effectiveRole = (
  game: Pick<Game, 'playStyle' | 'phase'>,
  player: Pick<Player, 'role'>,
): Role =>
  game.playStyle === 'single' ? (game.phase === 'clue' ? 'spy' : 'guesser') : player.role;
export const normalize = (word: string) =>
  word
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[’'‐‑-]/g, '');
export function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
