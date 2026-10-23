import { describe, it, expect } from 'vitest';
import { Decoder, encode } from '../src/protocol/framing';
import {
  APP_VERSION,
  command,
  envelope,
  hello,
  parse,
  VersionMismatchError,
} from '../src/protocol/messages';
import { Authority, HostStore } from '../src/session/authority';
let serial = 0;
const token = () => (++serial).toString(16).padStart(64, '0');
const random = (n: number) => n - 1;
const make = () => new AuthorityFactory();
class AuthorityFactory {
  saved: HostStore | null = null;
  fail = false;
  storage = {
    save: async (data: HostStore) => {
      if (this.fail) throw new Error('Disco pieno');
      this.saved = structuredClone(data);
    },
  };
  authority = Authority.create('Host', 'bluetooth', token, random, this.storage);
  cmd(action: unknown, version = this.authority.data.game.version) {
    return command({
      v: 1,
      type: 'command',
      gameId: this.authority.data.game.id,
      id: token(),
      version,
      action,
    });
  }
}
describe('framing e schema', () => {
  it('accetta solo la stessa versione app, incluse patch, senza eccezioni per versioni mancanti', () => {
    expect(parse(JSON.stringify(envelope({ type: 'hello' }))).appVersion).toBe(APP_VERSION);
    for (const appVersion of [
      '0.3.1',
      `${APP_VERSION}-next`,
      '99.0.0',
      undefined,
      null,
      3,
      '',
      '0.3.2-extra',
    ]) {
      expect(() => parse(JSON.stringify({ v: 1, type: 'hello', appVersion }))).toThrow(
        VersionMismatchError,
      );
    }
    expect(() => parse(JSON.stringify({ v: 1, appVersion: '0.3.1' }))).toThrow(APP_VERSION);
    expect(() => parse(JSON.stringify({ v: 2, appVersion: '99.0.0' }))).toThrow(
      VersionMismatchError,
    );
    expect(() => parse(JSON.stringify({ v: 2, appVersion: APP_VERSION }))).toThrow(
      'protocollo incompatibile',
    );
  });
  it('UTF8 frammentato byte per byte e frame concatenati', () => {
    const a = encode('caffè 🗝');
    const b = encode('secondo');
    const d = new Decoder();
    const result: string[] = [];
    for (const x of a) result.push(...d.feed(new Uint8Array([x])));
    result.push(...d.feed(b));
    expect(result).toEqual(['caffè 🗝', 'secondo']);
    const both = new Uint8Array(a.length + b.length);
    both.set(a);
    both.set(b, a.length);
    expect(new Decoder().feed(both)).toEqual(result);
  });
  it('limiti frame, UTF8 corrotto e schema/protocollo incompatibile', () => {
    expect(() => encode('a'.repeat(32769))).toThrow();
    expect(() => new Decoder().feed(new Uint8Array([255, 255, 255, 255]))).toThrow();
    expect(() => new Decoder().feed(new Uint8Array([0, 0, 0, 1, 255]))).toThrow();
    expect(() => parse('{"v":2}')).toThrow();
    expect(() => parse('[]')).toThrow();
    expect(() => hello({ type: 'hello', nickname: 'a\nsecret', roomCode: '' })).toThrow();
    const f = make();
    expect(() => f.cmd({ type: 'guess', index: -1 })).toThrow();
    expect(() => f.cmd({ type: 'ready', ready: 'true' })).toThrow();
  });
});
describe('autorità e persistenza', () => {
  it('nuovi ingressi alternano squadra anche dopo rimozioni e ripristino', async () => {
    const f = make(),
      a = f.authority;
    const one = await a.join('Primo');
    const two = await a.join('Secondo');
    expect(a.data.game.players.map((p) => p.team)).toEqual(['red', 'blue', 'red']);
    await a.execute(a.data.game.hostId, f.cmd({ type: 'remove', playerId: one.playerId }));
    const restored = new Authority(f.saved!, f.storage, token, random);
    const three = await restored.join('Terzo');
    expect(restored.data.game.players.find((p) => p.id === three.playerId)?.team).toBe('blue');
    expect(restored.data.game.players.find((p) => p.id === two.playerId)?.team).toBe('red');
    await restored.join('Quarto');
    expect(restored.data.game.players.at(-1)?.team).toBe('red');
  });
  it('join, credenziali non trasferibili tra partite e revoca', async () => {
    const f = make(),
      a = f.authority;
    const c = await a.join('Anna');
    expect(a.authenticate(c)).toBe(c.playerId);
    expect(() => make().authority.authenticate(c)).toThrow();
    expect(() => a.authenticate({ ...c, token: token() })).toThrow();
    const r = await a.execute(a.data.game.hostId, f.cmd({ type: 'remove', playerId: c.playerId }));
    expect(r.ok).toBe(true);
    expect(() => a.authenticate(c)).toThrow();
  });
  it('comandi duplicati durabili: nessuna seconda applicazione, anche dopo riavvio', async () => {
    const f = make(),
      a = f.authority;
    const c = f.cmd({ type: 'ready', ready: true });
    const host = a.data.game.hostId;
    const first = await a.execute(host, c);
    expect(await a.execute(host, c)).toEqual(first);
    expect(a.data.game.version).toBe(1);
    const recovered = new Authority(f.saved!, f.storage, token, random);
    await recovered.recover();
    expect(await recovered.execute(host, c)).toEqual(first);
  });
  it('concorrenza: prima azione valida prevale; payload con identità contraffatta ignorato', async () => {
    const f = make(),
      a = f.authority;
    const id = a.data.game.hostId;
    const one = f.cmd({ type: 'ready', ready: true });
    const two = f.cmd({ type: 'choose', team: 'blue', role: 'spy', playerId: 'fake' });
    const results = await Promise.all([a.execute(id, one), a.execute(id, two)]);
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    expect(results[1]!.error).toContain('Stato aggiornato');
    expect(a.data.game.players[0]!.team).toBe('red');
  });
  it('fallimento scrittura: nessuna mutazione né conferma positiva', async () => {
    const f = make();
    f.fail = true;
    const a = f.authority;
    await expect(
      a.execute(a.data.game.hostId, f.cmd({ type: 'ready', ready: true })),
    ).rejects.toThrow('Disco pieno');
    expect(a.data.game.version).toBe(0);
    expect(a.data.game.players[0]!.ready).toBe(false);
  });
  it('recupero: host online, sessioni e versione conservate, altri offline', async () => {
    const f = make(),
      a = f.authority;
    const c = await a.join('Anna');
    const before = a.data.game.version;
    const restart = new Authority(f.saved!, f.storage, token, random);
    await restart.recover();
    expect(restart.data.game.version).toBe(before + 1);
    expect(restart.data.game.players.find((p) => p.id === c.playerId)!.connected).toBe(false);
    expect(restart.authenticate(c)).toBe(c.playerId);
    await restart.presence(c.playerId, true);
    expect(restart.data.game.players.every((p) => p.connected)).toBe(true);
  });
  it('partita diversa rifiutata; rate cache limitata e stanza limitata', async () => {
    const f = make(),
      a = f.authority;
    const bad = { ...f.cmd({ type: 'sync' }), gameId: token() };
    await expect(a.execute(a.data.game.hostId, bad)).rejects.toThrow('Partita diversa');
    for (let i = 0; i < 9; i++) await a.join(`Utente${i}`);
    expect(a.data.game.players).toHaveLength(10);
    await expect(a.join('Undicesimo')).rejects.toThrow('piena');
  });
});
