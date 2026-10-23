import { describe, it, expect } from 'vitest';
import { apply, board, expireTurn, newGame, project, validLobby } from '../src/core/engine';
import { Game, Player, Team, normalize, other } from '../src/core/model';
import { words } from '../src/content/it';
const random = (n: number) => Math.floor(Math.random() * n);
export const players: Player[] = [
  { id: 'a', nickname: 'Anna', team: 'red', role: 'spy', ready: true, connected: true },
  { id: 'b', nickname: 'Bruno', team: 'red', role: 'guesser', ready: true, connected: true },
  { id: 'c', nickname: 'Carla', team: 'blue', role: 'spy', ready: true, connected: true },
  { id: 'd', nickname: 'Diego', team: 'blue', role: 'guesser', ready: true, connected: true },
];
export function lobby(): Game {
  const g = newGame('game', { ...players[0]! });
  g.players = structuredClone(players);
  return g;
}
export function started(): Game {
  return apply(lobby(), 'a', { type: 'start' }, random);
}
export const spy = (t: Team) => (t === 'red' ? 'a' : 'c');
export const guesser = (t: Team) => (t === 'red' ? 'b' : 'd');
export function clue(g: Game, count: number | 'infinity' = 2) {
  return apply(g, spy(g.active), { type: 'clue', word: 'Ineffabile', count }, random);
}
export function choose(g: Game, color: string) {
  return apply(
    g,
    guesser(g.active),
    { type: 'guess', index: g.board.findIndex((c) => c.color === color && !c.revealed) },
    random,
  );
}

describe('contenuti e generazione', () => {
  it('dizionario originale: almeno 500 voci NFC senza equivalenti né caratteri errati', () => {
    expect(words.length).toBeGreaterThanOrEqual(500);
    expect(new Set(words.map(normalize)).size).toBe(words.length);
    words.forEach((w) => {
      expect(w).toBe(w.normalize('NFC'));
      expect(w).toMatch(/^\p{Ll}{2,16}$/u);
    });
  });
  it('100 tabelloni con 25 parole diverse, 9/8/7/1 e due squadre iniziali possibili', () => {
    const first = new Set();
    for (let i = 0; i < 100; i++) {
      const b = board(random);
      first.add(b.first);
      expect(new Set(b.cards.map((c) => normalize(c.word))).size).toBe(25);
      expect(b.cards.filter((c) => c.color === b.first)).toHaveLength(9);
      expect(b.cards.filter((c) => c.color === other(b.first))).toHaveLength(8);
      expect(b.cards.filter((c) => c.color === 'neutral')).toHaveLength(7);
      expect(b.cards.filter((c) => c.color === 'assassin')).toHaveLength(1);
    }
    expect(first.size).toBe(2);
  });
});
describe('lobby e ruoli', () => {
  it('solo composizione valida, pronta e connessa; più indovinatori ammessi', () => {
    const g = lobby();
    expect(validLobby(g)).toBe(true);
    g.players[3]!.ready = false;
    expect(validLobby(g)).toBe(false);
    g.players[3]!.ready = true;
    g.players.push({ ...players[3]!, id: 'e' });
    expect(validLobby(g)).toBe(true);
    g.players[3]!.role = 'spy';
    expect(validLobby(g)).toBe(false);
  });
  it('solo host avvia, un suggeritore per squadra, pronto azzerato al cambio', () => {
    expect(() => apply(lobby(), 'b', { type: 'start' }, random)).toThrow();
    expect(() =>
      apply(lobby(), 'b', { type: 'choose', team: 'red', role: 'spy' }, random),
    ).toThrow();
    const g = apply(lobby(), 'b', { type: 'choose', team: 'blue', role: 'guesser' }, random);
    expect(g.players[1]!.ready).toBe(false);
  });
  it('blocco ruoli e autorizzazioni durante la partita', () => {
    const g = started();
    expect(() => apply(g, 'b', { type: 'choose', team: 'blue', role: 'spy' }, random)).toThrow();
    expect(() =>
      apply(g, guesser(g.active), { type: 'clue', word: 'Sole', count: 2 }, random),
    ).toThrow();
    const c = clue(g);
    expect(() => apply(c, spy(g.active), { type: 'guess', index: 0 }, random)).toThrow();
    expect(() => apply(c, guesser(other(g.active)), { type: 'guess', index: 0 }, random)).toThrow();
  });
});
describe('turni e vittoria', () => {
  it('N+1 e almeno un tentativo prima di passare', () => {
    let g = clue(started(), 1);
    expect(g.remaining).toBe(2);
    expect(() => apply(g, guesser(g.active), { type: 'end' }, random)).toThrow();
    const team = g.active;
    g = choose(g, team);
    expect(g.remaining).toBe(1);
    const passed = apply(g, guesser(g.active), { type: 'end' }, random);
    expect(passed.active).toBe(other(team));
    g = choose(g, team);
    expect(g.active).toBe(other(team));
    expect(g.phase).toBe('clue');
  });
  it.each([0, 'infinity'] as const)('indizio speciale %s non limita i tentativi', (count) => {
    let g = clue(started(), count);
    const team = g.active;
    for (let i = 0; i < 4; i++) g = choose(g, team);
    expect(g.active).toBe(team);
    expect(g.phase).toBe('guess');
    expect(g.remaining).toBeNull();
  });
  it.each(['neutral', 'opponent'])('%s termina il turno', (color) => {
    const g = clue(started());
    expect(choose(g, color === 'opponent' ? other(g.active) : color).active).toBe(other(g.active));
  });
  it('assassino: sconfitta immediata', () => {
    const g = clue(started());
    const end = choose(g, 'assassin');
    expect(end.phase).toBe('finished');
    expect(end.winner).toBe(other(g.active));
  });
  it.each([true, false])('ultimo agente vince anche se scelto dall’avversario (%s)', (own) => {
    let g = clue(started());
    const winner = own ? g.active : other(g.active);
    const indices = g.board.map((c, i) => (c.color === winner ? i : -1)).filter((i) => i >= 0);
    indices.slice(1).forEach((i) => {
      g.board[i]!.revealed = true;
    });
    g = choose(g, winner);
    expect(g.phase).toBe('finished');
    expect(g.winner).toBe(winner);
  });
  it('client assente non ferma gli altri; sessione scollegata non può agire', () => {
    const g = started();
    g.players[3]!.connected = false;
    expect(clue(g).phase).toBe('guess');
    expect(project(g, 'a').paused).toBe(false);
    expect(() => apply(g, 'd', { type: 'sync' }, random)).toThrow('scollegata');
    let end = apply(g, 'a', { type: 'cancel' }, random);
    end = apply(end, 'a', { type: 'lobby' }, random);
    expect(end.board).toHaveLength(0);
    expect(end.players.every((p) => !p.ready)).toBe(true);
  });
  it('la squadra che sceglie resta sulla carta dopo il cambio turno e nella proiezione pubblica', () => {
    const g = clue(started());
    const team = g.active;
    const index = g.board.findIndex((c) => c.color === other(team));
    const selected = apply(g, guesser(team), { type: 'guess', index }, random);
    expect(selected.active).toBe(other(team));
    expect(selected.board[index]!.selectedBy).toBe(team);
    for (const p of selected.players)
      expect(project(selected, p.id).board[index]!.selectedBy).toBe(team);
    expect(
      project(selected, guesser(team))
        .board.filter((c) => !c.revealed)
        .every((c) => !('selectedBy' in c)),
    ).toBe(true);
  });
  it('shuffle solo host in lobby: squadre bilanciate, ruoli preservati, massimo un suggeritore e pronti azzerati', () => {
    expect(() => apply(lobby(), 'b', { type: 'shuffle' }, random)).toThrow('host');
    expect(() => apply(started(), 'a', { type: 'shuffle' }, random)).toThrow('bloccati');
    for (let n = 4; n <= 10; n++) {
      const g = lobby();
      while (g.players.length < n)
        g.players.push({ ...players[1]!, id: `extra${g.players.length}` });
      const result = apply(g, 'a', { type: 'shuffle' }, random);
      expect(
        Math.abs(
          result.players.filter((p) => p.team === 'red').length -
            result.players.filter((p) => p.team === 'blue').length,
        ),
      ).toBeLessThanOrEqual(1);
      for (const team of ['red', 'blue'])
        expect(result.players.filter((p) => p.team === team && p.role === 'spy')).toHaveLength(1);
      expect(result.players.every((p) => !p.ready)).toBe(true);
      for (const p of g.players)
        expect(result.players.find((x) => x.id === p.id)?.role).toBe(p.role);
    }
    const solo = newGame('solo', { ...players[0]! });
    expect(apply(solo, 'a', { type: 'shuffle' }, () => 0).players).toHaveLength(1);
  });
  it('timer facoltativo: scadenza nel suggerimento o nelle scelte, un solo cambio e nuovo turno completo', () => {
    const start = 100000;
    const g = lobby();
    g.turnSeconds = 30;
    const timed = apply(g, 'a', { type: 'start' }, random, start);
    expect(timed.turnEndsAt).toBe(start + 30000);
    expect(expireTurn(timed, start + 29999)).toBeNull();
    const withClue = apply(
      timed,
      spy(timed.active),
      { type: 'clue', word: 'Ineffabile', count: 1 },
      random,
      start + 1000,
    );
    expect(withClue.turnEndsAt).toBe(timed.turnEndsAt);
    for (const state of [timed, withClue]) {
      const expired = expireTurn(state, start + 30000)!;
      expect(expired.active).toBe(other(timed.active));
      expect(expired.phase).toBe('clue');
      expect(expired.clue).toBeNull();
      expect(expired.turnEndsAt).toBe(start + 60000);
      expect(expired.version).toBe(state.version + 1);
      expect(expireTurn(expired, start + 30000)).toBeNull();
    }
    expect(() =>
      apply(
        timed,
        spy(timed.active),
        { type: 'clue', word: 'Ineffabile', count: 2 },
        random,
        start + 30000,
      ),
    ).toThrow('scaduto');
    expect(expireTurn(started(), Number.MAX_SAFE_INTEGER)).toBeNull();
    expect(() => newGame('bad', { ...players[0]! }, 1)).toThrow('Durata');
    const ended = apply(timed, 'a', { type: 'cancel' }, random, start + 1000);
    expect(ended.turnEndsAt).toBeNull();
    expect(expireTurn(ended, start + 60000)).toBeNull();
  });
  it('molte scadenze senza scelte non fanno crescere gli snapshot oltre la capacità del ponte', () => {
    const initial = lobby();
    initial.turnSeconds = 30;
    let now = 100000,
      g = apply(initial, 'a', { type: 'start' }, random, now);
    while (g.players.length < 10)
      g.players.push({ ...players[1]!, id: `extra${g.players.length}`, nickname: '𐐀'.repeat(10) });
    for (let i = 0; i < 500; i++) {
      now += 30000;
      g = expireTurn(g, now)!;
    }
    expect(g.history).toHaveLength(100);
    const snapshot = JSON.stringify({
      type: 'state',
      v: 1,
      hostTime: now,
      view: project(g, spy(g.active)),
    });
    expect(
      new TextEncoder().encode(
        JSON.stringify({ seq: 500, sender: 'f'.repeat(64), payload: snapshot }),
      ).length,
    ).toBeLessThan(14500);
  });
  it('input indizi, apostrofi, accenti e parole coperte', () => {
    const g = started();
    g.board[0]!.word = 'Caffè';
    for (const word of ['CAFFE', 'caffè', 'due parole', 'a', 'x'.repeat(33), 'sole2', '-sole'])
      expect(() => apply(g, spy(g.active), { type: 'clue', word, count: 2 }, random)).toThrow();
    expect(
      apply(g, spy(g.active), { type: 'clue', word: 'd’argento', count: 0 }, random).phase,
    ).toBe('guess');
  });
  it('proiezione indovinatore host e client non contiene colori coperti; entrambi i suggeritori sì', () => {
    const g = choose(clue(started()), 'neutral');
    for (const p of g.players) {
      const v = project(g, p.id);
      expect(v.board.filter((c) => c.color !== undefined)).toHaveLength(p.role === 'spy' ? 25 : 1);
      expect(v).not.toHaveProperty('seed');
      expect(v).not.toHaveProperty('sessions');
      v.board.forEach((c) => {
        if (!c.revealed && p.role === 'guesser')
          expect(Object.keys(c)).toEqual(['word', 'revealed']);
      });
    }
    expect(() => project(g, 'sconosciuto')).toThrow();
  });
});
