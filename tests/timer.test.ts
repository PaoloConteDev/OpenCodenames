import { describe, expect, it } from 'vitest';
import { apply, newGame } from '../src/core/engine';
import { Action, Player } from '../src/core/model';
import { Authority, clone, HostStore } from '../src/session/authority';

function timed() {
  let serial = 0,
    now = 100000,
    fail = false;
  const token = () => (++serial).toString(16).padStart(64, '0');
  const random = () => 0;
  const players: Player[] = [
    { id: token(), nickname: 'Host', team: 'red', role: 'guesser', ready: true, connected: true },
    { id: token(), nickname: 'Rossa', team: 'red', role: 'spy', ready: true, connected: true },
    { id: token(), nickname: 'Blu', team: 'blue', role: 'spy', ready: true, connected: true },
    {
      id: token(),
      nickname: 'Client',
      team: 'blue',
      role: 'guesser',
      ready: true,
      connected: true,
    },
  ];
  const game = newGame(token(), players[0]!, 30);
  game.players = players;
  let saved: HostStore;
  const storage = {
    save: async (data: HostStore) => {
      if (fail) throw new Error('Disco pieno');
      saved = clone(data);
    },
  };
  const data: HostStore = {
    schema: 1,
    game: apply(game, game.hostId, { type: 'start' }, random, now),
    mode: 'lan',
    roomCode: 'ABCDEF',
    sessions: players.map((p) => ({ playerId: p.id, token: token(), receipts: [] })),
  };
  const a = new Authority(data, storage, token, random, () => now);
  const cmd = (action: Action) => ({
    v: 1 as const,
    type: 'command' as const,
    id: token(),
    gameId: a.data.game.id,
    version: a.data.game.version,
    action,
  });
  return {
    a,
    cmd,
    token,
    random,
    storage,
    now: () => now,
    time: (ms: number) => {
      now += ms;
    },
    fail: (value: boolean) => {
      fail = value;
    },
    saved: () => saved,
  };
}
describe('timer autorevole, persistenza e recupero', () => {
  it('host sospende il residuo e lo riprende senza consumarlo in background', async () => {
    const f = timed(),
      a = f.a;
    f.time(20000);
    await a.pauseClock();
    expect(a.data.pausedTurnMs).toBe(10000);
    expect(a.data.game.turnEndsAt).toBeNull();
    f.time(600000);
    await a.recover();
    const restored = new Authority(f.saved(), f.storage, f.token, f.random, f.now);
    await restored.resumeClock();
    expect(restored.data.game.turnEndsAt).toBe(f.now() + 10000);
    const version = restored.data.game.version;
    await restored.resumeClock();
    expect(restored.data.game.version).toBe(version);
    f.time(9999);
    expect(await restored.advanceClock()).toBe(false);
    f.time(1);
    const team = restored.data.game.active;
    expect(await restored.advanceClock()).toBe(true);
    expect(restored.data.game.active).not.toBe(team);
    expect(await restored.advanceClock()).toBe(false);
  });
  it('un comando arrivato alla scadenza non applica una carta o un indizio al nuovo turno', async () => {
    const f = timed(),
      a = f.a;
    const actor = a.data.game.players.find(
      (p) => p.role === 'spy' && p.team === a.data.game.active,
    )!;
    const command = f.cmd({ type: 'clue', word: 'Ineffabile', count: 2 });
    const team = a.data.game.active;
    f.time(30000);
    const results = await Promise.all([a.execute(actor.id, command), a.advanceClock()]);
    expect(results[0].ok).toBe(false);
    expect(results[1]).toBe(false);
    expect(a.data.game.active).not.toBe(team);
    expect(a.data.game.clue).toBeNull();
    expect(a.data.game.history.filter((line) => line.startsWith('Tempo scaduto'))).toHaveLength(1);
    expect(await a.execute(actor.id, command)).toEqual(results[0]);
  });
  it('scadenza viene pubblicata soltanto dopo il salvataggio riuscito', async () => {
    const f = timed(),
      a = f.a;
    const before = clone(a.data);
    f.time(30000);
    f.fail(true);
    await expect(a.advanceClock()).rejects.toThrow('Disco pieno');
    expect(a.data).toEqual(before);
    f.fail(false);
    expect(await a.advanceClock()).toBe(true);
    expect(a.data.game.version).toBe(before.game.version + 1);
  });
  it('carica le vecchie stanze senza imporre un timer', () => {
    const f = timed(),
      legacy = clone(f.a.data);
    delete (legacy.game as Partial<typeof legacy.game>).turnSeconds;
    delete (legacy.game as Partial<typeof legacy.game>).turnEndsAt;
    const a = new Authority(legacy, f.storage, f.token, f.random);
    expect(a.data.game.turnSeconds).toBeNull();
    expect(a.view(a.data.game.hostId).turnEndsAt).toBeNull();
  });
  it('un arresto improvviso con scadenza trascorsa produce un solo cambio al recupero', async () => {
    const f = timed();
    const saved = clone(f.a.data);
    const before = saved.game.active;
    f.time(600000);
    const restored = new Authority(saved, f.storage, f.token, f.random, f.now);
    await restored.recover();
    await restored.resumeClock();
    expect(await restored.advanceClock()).toBe(true);
    expect(restored.data.game.active).not.toBe(before);
    expect(restored.data.game.turnEndsAt).toBe(f.now() + 30000);
    expect(await restored.advanceClock()).toBe(false);
  });
});
