import { describe, expect, it } from 'vitest';
import { apply, expireTurn, newGame, project, validLobby } from '../src/core/engine';
import { Action, Game, needsHandoff, other } from '../src/core/model';
import { Authority, clone, HostStore } from '../src/session/authority';
import { command } from '../src/protocol/messages';

const random = (n: number) => n - 1;
function shared(count = 2, seconds: number | null = null) {
  const g = newGame(
    'game',
    { id: 'spy', nickname: 'Suggeritori', team: 'red', role: 'spy', ready: true, connected: true },
    seconds,
    'shared',
  );
  for (let i = 1; i < count; i++)
    g.players.push({
      id: `d${i}`,
      nickname: `Decifratori${i}`,
      team: 'red',
      role: 'guesser',
      ready: true,
      connected: true,
    });
  return g;
}
const start = (count = 2, seconds: number | null = null) =>
  apply(shared(count, seconds), 'spy', { type: 'start' }, random, 1000);
const confirm = (g: Game, actor: string) =>
  apply(g, actor, { type: 'handoff', turn: g.turn }, random, 1001);
const clue = (g: Game) =>
  apply(g, 'spy', { type: 'clue', word: 'Ineffabile', count: 3 }, random, 1002);

describe('partita condivisa', () => {
  it('parte con due dispositivi, esattamente uno per i suggeritori, fino al limite di dieci', () => {
    expect(validLobby(shared(1))).toBe(false);
    expect(validLobby(shared(2))).toBe(true);
    expect(validLobby(shared(10))).toBe(true);
    expect(validLobby(shared(11))).toBe(false);
    const g = shared();
    g.players[1]!.role = 'spy';
    expect(validLobby(g)).toBe(false);
    g.players[1]!.role = 'guesser';
    g.players[0]!.role = 'guesser';
    expect(validLobby(g)).toBe(false);
    g.players[0]!.role = 'spy';
    g.players[1]!.connected = false;
    expect(validLobby(g)).toBe(false);
    g.players[1]!.connected = true;
    g.players[1]!.ready = false;
    expect(validLobby(g)).toBe(false);
  });
  it('impedisce il secondo dispositivo suggeritori anche scegliendo una squadra diversa', () => {
    expect(() =>
      apply(shared(), 'd1', { type: 'choose', team: 'blue', role: 'spy' }, random),
    ).toThrow('già presente');
    let g = apply(shared(), 'spy', { type: 'choose', team: 'blue', role: 'guesser' }, random);
    g = apply(g, 'd1', { type: 'choose', team: 'blue', role: 'spy' }, random);
    expect(g.players[1]!.role).toBe('spy');
    expect(g.players.every((p) => !p.ready)).toBe(true);
    expect(() => apply(g, 'spy', { type: 'shuffle' }, random)).toThrow('squadra di turno');
  });
  it('non trasmette i colori coperti prima della conferma, né mai ai decifratori', () => {
    let g = start();
    expect(project(g, 'spy').board.every((c) => !('color' in c))).toBe(true);
    expect(() => clue(g)).toThrow('Conferma');
    g = confirm(g, 'spy');
    expect(project(g, 'spy').board.every((c) => 'color' in c)).toBe(true);
    g = confirm(g, 'd1');
    expect(project(g, 'd1').board.every((c) => !('color' in c))).toBe(true);
  });
  it('gli stessi due dispositivi giocano per entrambe le squadre, pallino compreso', () => {
    let g = start();
    expect(g.active).toBe('blue');
    for (let i = 0; i < 2; i++) {
      const team = g.active;
      g = clue(confirm(g, 'spy'));
      expect(() => apply(g, 'd1', { type: 'guess', index: 0 }, random, 1003)).toThrow('Conferma');
      g = confirm(g, 'd1');
      const index = g.board.findIndex((c) => c.color === team && !c.revealed);
      g = apply(g, 'd1', { type: 'guess', index }, random, 1004);
      expect(g.board[index]!.selectedBy).toBe(team);
      expect(project(g, 'd1').board.filter((c) => 'color' in c)).toHaveLength(i + 1);
      g = apply(g, 'd1', { type: 'end' }, random, 1005);
      expect(g.active).toBe(other(team));
      expect(needsHandoff(g, g.players[0])).toBe(true);
      expect(needsHandoff(g, g.players[1])).toBe(true);
      expect(
        project(g, 'spy')
          .board.filter((c) => !c.revealed)
          .every((c) => !('color' in c)),
      ).toBe(true);
    }
  });
  it('mantiene separati ruoli e conferme dei diversi dispositivi decifratori', () => {
    let g = clue(confirm(start(3), 'spy'));
    expect(() => apply(g, 'spy', { type: 'guess', index: 0 }, random, 1003)).toThrow('ruolo');
    expect(() => apply(g, 'd1', { type: 'choose', team: 'blue', role: 'spy' }, random)).toThrow(
      'bloccati',
    );
    g = confirm(g, 'd1');
    expect(needsHandoff(g, g.players[1])).toBe(false);
    expect(needsHandoff(g, g.players[2])).toBe(true);
    expect(() => apply(g, 'd2', { type: 'guess', index: 0 }, random, 1003)).toThrow('Conferma');
    g = confirm(g, 'd2');
    expect(project(g, 'd2').board.every((c) => !('color' in c))).toBe(true);
  });
  it('una scadenza richiede nuovi passaggi e rifiuta conferme riferite al turno precedente', () => {
    let g = confirm(start(2, 30), 'spy');
    const turn = g.turn;
    g = expireTurn(g, 31000)!;
    expect(g.turn).toBe(turn + 1);
    expect(needsHandoff(g, g.players[0])).toBe(true);
    expect(project(g, 'spy').board.every((c) => !('color' in c))).toBe(true);
    expect(() => apply(g, 'spy', { type: 'handoff', turn }, random, 31001)).toThrow(
      'turno è cambiato',
    );
  });
  it('nuova missione non riutilizza conferme e la classica rimane senza passaggi', () => {
    let g = confirm(start(), 'spy');
    const turn = g.turn;
    g = apply(g, 'spy', { type: 'cancel' }, random);
    g = apply(g, 'spy', { type: 'lobby' }, random);
    g.players.forEach((p) => {
      p.ready = true;
    });
    g = apply(g, 'spy', { type: 'start' }, random);
    expect(g.turn).toBeGreaterThan(turn);
    expect(needsHandoff(g, g.players[0])).toBe(true);
    const classic = newGame('classic', { ...g.players[0]! });
    expect(validLobby(classic)).toBe(false);
    expect(needsHandoff(classic, classic.players[0])).toBe(false);
    expect(() => apply(classic, 'spy', { type: 'handoff', turn: 1 }, random)).toThrow(
      'Nessun passaggio',
    );
  });
  it('valida il turno delle conferme nel protocollo', () => {
    const base = { type: 'command', gameId: 'a'.repeat(64), id: 'b'.repeat(64), version: 1 };
    expect(command({ ...base, action: { type: 'handoff', turn: 1 } }).action).toEqual({
      type: 'handoff',
      turn: 1,
    });
    for (const turn of [undefined, 0, -1, 1.5, '1'])
      expect(() => command({ ...base, action: { type: 'handoff', turn } })).toThrow('Turno');
  });
});

describe('autorità condivisa e recupero', () => {
  it('una conferma non persistita non sblocca la mappa', async () => {
    let serial = 0,
      fail = false;
    const token = () => (++serial).toString(16).padStart(64, '0');
    const a = Authority.create(
      'Suggeritori',
      'lan',
      token,
      random,
      {
        save: async () => {
          if (fail) throw new Error('Disco pieno');
        },
      },
      null,
      'shared',
    );
    const d = await a.join('Decifratori');
    const host = a.data.game.hostId;
    const act = (playerId: string, action: Action) =>
      a.execute(playerId, {
        v: 1,
        type: 'command',
        gameId: a.data.game.id,
        id: token(),
        version: a.data.game.version,
        action,
      });
    await act(host, { type: 'ready', ready: true });
    await act(d.playerId, { type: 'ready', ready: true });
    await act(host, { type: 'start' });
    fail = true;
    await expect(act(host, { type: 'handoff', turn: a.data.game.turn })).rejects.toThrow(
      'Disco pieno',
    );
    expect(a.view(host).board.every((c) => !('color' in c))).toBe(true);
    fail = false;
    expect((await act(host, { type: 'handoff', turn: a.data.game.turn })).ok).toBe(true);
    expect(a.view(host).board.every((c) => 'color' in c)).toBe(true);
  });
  it('conferme simultanee dello stesso turno sono accettate e non quelle di un turno superato', async () => {
    let serial = 0;
    const token = () => (++serial).toString(16).padStart(64, '0');
    let saved: HostStore | undefined;
    const a = Authority.create(
      'Suggeritori',
      'lan',
      token,
      random,
      {
        save: async (data) => {
          saved = clone(data);
        },
      },
      null,
      'shared',
    );
    const d = await a.join('Decifratori');
    const host = a.data.game.hostId;
    const act = (playerId: string, action: Action, version = a.data.game.version) =>
      a.execute(playerId, {
        v: 1,
        type: 'command',
        gameId: a.data.game.id,
        id: token(),
        version,
        action,
      });
    await act(host, { type: 'ready', ready: true });
    await act(d.playerId, { type: 'ready', ready: true });
    expect((await act(host, { type: 'start' })).ok).toBe(true);
    const version = a.data.game.version,
      turn = a.data.game.turn;
    const confirmations = await Promise.all([
      act(host, { type: 'handoff', turn }, version),
      act(d.playerId, { type: 'handoff', turn }, version),
    ]);
    expect(confirmations.every((r) => r.ok)).toBe(true);
    await act(host, { type: 'clue', word: 'Ineffabile', count: 1 });
    const index = a.data.game.board.findIndex((c) => c.color === 'neutral');
    await act(d.playerId, { type: 'guess', index });
    expect((await act(host, { type: 'handoff', turn }, version)).ok).toBe(false);
    const recovered = new Authority(saved!, { save: async () => {} }, token, random);
    await recovered.recover();
    expect(recovered.data.game.playStyle).toBe('shared');
    expect(recovered.data.game.turn).toBe(turn + 1);
    expect(needsHandoff(recovered.data.game, recovered.data.game.players[0])).toBe(true);
    expect(
      recovered
        .view(host)
        .board.filter((c) => !c.revealed)
        .every((c) => !('color' in c)),
    ).toBe(true);
    await recovered.presence(d.playerId, true);
    expect(recovered.authenticate(d)).toBe(d.playerId);
  });
  it('le stanze senza modalità e contatore turno vengono recuperate come classiche', () => {
    let serial = 0;
    const token = () => (++serial).toString(16).padStart(64, '0');
    const a = Authority.create('Host', 'lan', token, random, { save: async () => {} });
    const old = clone(a.data) as any;
    delete old.game.playStyle;
    delete old.game.turn;
    const recovered = new Authority(old, { save: async () => {} }, token, random);
    expect(recovered.data.game).toMatchObject({ playStyle: 'classic', turn: 0 });
  });
});
