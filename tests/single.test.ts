import { describe, expect, it } from 'vitest';
import { apply, expireTurn, newGame, project, validLobby } from '../src/core/engine';
import { Action, effectiveRole, Game, needsHandoff, other } from '../src/core/model';
import { Authority, clone, HostStore } from '../src/session/authority';
import { command } from '../src/protocol/messages';

const random = (n: number) => n - 1;
function lobby(seconds: number | null = null) {
  return newGame(
    'game',
    {
      id: 'phone',
      nickname: 'Telefono',
      team: 'red',
      role: 'guesser',
      ready: true,
      connected: true,
    },
    seconds,
    'single',
  );
}
const start = (seconds: number | null = null) =>
  apply(lobby(seconds), 'phone', { type: 'start' }, random, 1000);
const confirm = (g: Game) =>
  apply(
    g,
    'phone',
    { type: 'handoff', turn: g.turn, phase: g.phase as 'clue' | 'guess' },
    random,
    1001,
  );
const clue = (g: Game) =>
  apply(g, 'phone', { type: 'clue', word: 'Ineffabile', count: 2 }, random, 1002);
const hiddenColors = (g: Game) =>
  project(g, 'phone').board.filter((c) => !c.revealed && 'color' in c).length;

describe('Single device', () => {
  it('ammette un solo telefono pronto, senza assegnazioni personali di squadra o ruolo', () => {
    const g = lobby();
    expect(validLobby(g)).toBe(true);
    g.players[0]!.ready = false;
    expect(validLobby(g)).toBe(false);
    g.players[0]!.ready = true;
    g.players[0]!.connected = false;
    expect(validLobby(g)).toBe(false);
    g.players[0]!.connected = true;
    g.players.push({ ...g.players[0]!, id: 'extra' });
    expect(validLobby(g)).toBe(false);
    expect(() =>
      apply(lobby(), 'phone', { type: 'choose', team: 'blue', role: 'spy' }, random),
    ).toThrow('automaticamente');
    expect(() => apply(lobby(), 'phone', { type: 'shuffle' }, random)).toThrow('squadra di turno');
  });
  it('mostra la mappa solo al suggeritore confermato e la nasconde subito dopo l’indizio', () => {
    let g = start();
    expect(effectiveRole(g, g.players[0]!)).toBe('spy');
    expect(needsHandoff(g, g.players[0])).toBe(true);
    expect(hiddenColors(g)).toBe(0);
    expect(() => clue(g)).toThrow('Conferma');
    g = confirm(g);
    expect(hiddenColors(g)).toBe(25);
    const phase = g.phase;
    g = clue(g);
    expect(effectiveRole(g, g.players[0]!)).toBe('guesser');
    expect(hiddenColors(g)).toBe(0);
    expect(needsHandoff(g, g.players[0])).toBe(true);
    expect(() =>
      apply(g, 'phone', { type: 'handoff', turn: g.turn, phase: phase as 'clue' }, random, 1003),
    ).toThrow('fase è cambiata');
    expect(() => apply(g, 'phone', { type: 'guess', index: 0 }, random, 1003)).toThrow('Conferma');
    expect(() => apply(g, 'phone', { type: 'handoff', turn: g.turn }, random, 1003)).toThrow(
      'fase è cambiata',
    );
    g = confirm(g);
    expect(hiddenColors(g)).toBe(0);
  });
  it('alterna ruoli e squadre sullo stesso telefono, conservando colori pubblici e pallini', () => {
    let g = start();
    for (let i = 0; i < 2; i++) {
      const team = g.active;
      g = clue(confirm(g));
      g = confirm(g);
      const index = g.board.findIndex((c) => c.color === team && !c.revealed);
      g = apply(g, 'phone', { type: 'guess', index }, random, 1003);
      expect(g.board[index]!.selectedBy).toBe(team);
      expect(hiddenColors(g)).toBe(0);
      expect(needsHandoff(g, g.players[0])).toBe(false);
      g = apply(g, 'phone', { type: 'end' }, random, 1004);
      expect(g.active).toBe(other(team));
      expect(effectiveRole(g, g.players[0]!)).toBe('spy');
      expect(needsHandoff(g, g.players[0])).toBe(true);
      expect(hiddenColors(g)).toBe(0);
    }
  });
  it('blocca il ruolo sbagliato e non mostra la mappa alla fine della partita', () => {
    let g = confirm(start());
    expect(() => apply(g, 'phone', { type: 'guess', index: 0 }, random)).toThrow('ruolo');
    g = confirm(clue(g));
    expect(() => clue(g)).toThrow('ruolo');
    const index = g.board.findIndex((c) => c.color === 'assassin');
    g = apply(g, 'phone', { type: 'guess', index }, random, 1004);
    expect(g.phase).toBe('finished');
    expect(hiddenColors(g)).toBe(0);
    expect(() => confirm(g)).toThrow('Nessun passaggio');
  });
  it('scadenza e nuova missione non riutilizzano conferme precedenti', () => {
    let g = confirm(start(30));
    const turn = g.turn;
    g = expireTurn(g, 31000)!;
    expect(g.turn).toBe(turn + 1);
    expect(hiddenColors(g)).toBe(0);
    expect(() =>
      apply(g, 'phone', { type: 'handoff', turn, phase: 'clue' }, random, 31001),
    ).toThrow('turno è cambiato');
    g = apply(g, 'phone', { type: 'cancel' }, random, 31002);
    g = apply(g, 'phone', { type: 'lobby' }, random, 31003);
    expect(validLobby(g)).toBe(true);
    g = apply(g, 'phone', { type: 'start' }, random, 31004);
    expect(g.turn).toBeGreaterThan(turn + 1);
    expect(needsHandoff(g, g.players[0])).toBe(true);
  });
  it('valida la fase opzionale senza alterare i passaggi della modalità Condivisa', () => {
    const base = { type: 'command', gameId: 'a'.repeat(64), id: 'b'.repeat(64), version: 1 };
    expect(
      command({ ...base, action: { type: 'handoff', turn: 1, phase: 'guess' } }).action,
    ).toEqual({ type: 'handoff', turn: 1, phase: 'guess' });
    expect(command({ ...base, action: { type: 'handoff', turn: 1 } }).action).toEqual({
      type: 'handoff',
      turn: 1,
    });
    for (const phase of [null, 1, 'finished', 'spy'])
      expect(() => command({ ...base, action: { type: 'handoff', turn: 1, phase } })).toThrow(
        'Fase',
      );
  });
});

describe('persistenza Single device', () => {
  it('rifiuta ingressi, recupera la partita e chiede una nuova conferma prima di mostrare la mappa', async () => {
    let serial = 0,
      fail = false,
      saved: HostStore | undefined;
    const token = () => (++serial).toString(16).padStart(64, '0');
    const storage = {
      save: async (data: HostStore) => {
        if (fail) throw new Error('Disco pieno');
        saved = clone(data);
      },
    };
    const a = Authority.create('Telefono', 'bluetooth', token, random, storage, null, 'single');
    expect(a.data.mode).toBe('local');
    expect(a.data.game.players[0]!.ready).toBe(true);
    await expect(a.join('Estraneo')).rejects.toThrow('un solo telefono');
    const host = a.data.game.hostId;
    const act = (action: Action) =>
      a.execute(host, {
        v: 1,
        type: 'command',
        gameId: a.data.game.id,
        id: token(),
        version: a.data.game.version,
        action,
      });
    await act({ type: 'start' });
    fail = true;
    await expect(act({ type: 'handoff', turn: a.data.game.turn, phase: 'clue' })).rejects.toThrow(
      'Disco pieno',
    );
    expect(a.view(host).board.every((c) => !('color' in c))).toBe(true);
    fail = false;
    await act({ type: 'handoff', turn: a.data.game.turn, phase: 'clue' });
    expect(a.view(host).board.every((c) => 'color' in c)).toBe(true);
    const restored = new Authority(saved!, storage, token, random);
    await restored.recover();
    expect(restored.data.mode).toBe('local');
    expect(restored.data.game.phase).toBe('clue');
    expect(restored.view(host).board.every((c) => !('color' in c))).toBe(true);
    expect(needsHandoff(restored.data.game, restored.data.game.players[0])).toBe(true);
  });
});
