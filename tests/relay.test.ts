import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Relay } from '../src/session/relay';
import { envelope } from '../src/protocol/messages';
import { fingerprint, tunnelKeys } from '../src/protocol/secure-tunnel';
const random = () => randomBytes(32).toString('hex');
function network() {
  const queue: { to: string; from: string; message: any }[] = [];
  const wire: any[] = [],
    delivered: { peer: string; message: any }[] = [],
    closed: string[] = [];
  let waiting = '',
    ready = 0;
  const identity = tunnelKeys(random);
  const basic = {
    random,
    approved: () => true,
    status: () => {},
    close: async (p: string) => {
      closed.push(p);
    },
    disconnected: async (p: string) => {
      closed.push(p);
    },
    ready: async () => {},
    event: async () => {},
  };
  const root = new Relay({
    ...basic,
    wire: async (peer, message) => {
      wire.push(message);
      queue.push({ to: 'gateway', from: 'root', message });
    },
    event: async (peer, text) => {
      if (text) {
        const plain = await root.receive(peer, text);
        if (plain) delivered.push({ peer, message: JSON.parse(plain) });
      }
    },
  });
  const gateway = new Relay({
    ...basic,
    wire: async (peer, message) => {
      wire.push(message);
      queue.push({
        to: peer === 'root' ? 'root' : 'child',
        from: peer === 'root' ? 'gateway' : 'gateway',
        message,
      });
    },
  });
  const child = new Relay({
    ...basic,
    status: (fp) => {
      waiting = fp;
    },
    ready: async () => {
      ready++;
      await child.send('gateway', {
        type: 'hello',
        nickname: 'Ospite',
        resume: { token: 'SUPER-SEGRETO' },
      });
    },
    wire: async (_, message) => {
      wire.push(message);
      queue.push({ to: 'gateway', from: 'child', message });
    },
  });
  const pump = async () => {
    for (let n = 0; queue.length; n++) {
      if (n > 100) throw new Error('Ciclo nel ponte');
      const packet = queue.shift()!;
      const target = { root, gateway, child }[packet.to as 'root' | 'gateway' | 'child'];
      const plain = await target.receive(packet.from, JSON.stringify(envelope(packet.message)));
      if (plain) delivered.push({ peer: packet.from, message: JSON.parse(plain) });
    }
  };
  root.rootIdentity(identity);
  gateway.setEnabled(true, 'root');
  return {
    root,
    gateway,
    child,
    pump,
    wire,
    delivered,
    closed,
    identity,
    waiting: () => waiting,
    ready: () => ready,
  };
}
describe('ponte a un salto', () => {
  it('rifiuta un figlio con versione diversa prima di inoltrare il tunnel all’host', async () => {
    const n = network();
    await n.gateway.child('child');
    await n.pump();
    await expect(
      n.gateway.receive(
        'child',
        JSON.stringify({ v: 1, appVersion: '0.3.1', type: 'tunnel-hello', publicKey: random() }),
      ),
    ).rejects.toThrow('Versioni app incompatibili');
    expect(n.delivered).toHaveLength(0);
    expect(n.waiting()).toBe('');
  });
  it('conferma umana prima delle credenziali, cifratura end-to-end e instradamento bidirezionale', async () => {
    const n = network();
    await n.gateway.child('child');
    await n.pump();
    await n.child.begin('gateway');
    await n.pump();
    expect(n.waiting()).toBe(fingerprint(n.identity.publicKey));
    expect(n.ready()).toBe(0);
    expect(n.delivered).toHaveLength(0);
    await n.child.confirm();
    await n.pump();
    expect(n.delivered[0]!.message.resume.token).toBe('SUPER-SEGRETO');
    const virtual = n.delivered[0]!.peer;
    await n.root.send(virtual, { type: 'state', view: { secret: 'MAPPA-RISERVATA' } });
    await n.pump();
    expect(n.delivered.at(-1)!.message.view.secret).toBe('MAPPA-RISERVATA');
    expect(JSON.stringify(n.wire)).not.toContain('SUPER-SEGRETO');
    expect(JSON.stringify(n.wire)).not.toContain('MAPPA-RISERVATA');
    await n.root.close(virtual);
    await n.pump();
    expect(n.closed).toContain('child');
  });
  it('riconosce la chiave salvata e blocca un host sostituito prima di inviare credenziali', async () => {
    const n = network();
    await n.gateway.child('child');
    await n.pump();
    await n.child.begin('gateway', n.identity.publicKey);
    await n.pump();
    expect(n.ready()).toBe(1);
    const other = network();
    await other.gateway.child('child');
    await other.pump();
    await other.child.begin('gateway', n.identity.publicKey);
    await expect(other.pump()).rejects.toThrow('Identità host cambiata');
    expect(other.ready()).toBe(0);
  });
  it('limita a due figli, impedisce percorsi rubati, chiude i figli quando manca il ponte', async () => {
    const n = network();
    await n.gateway.child('child');
    await n.gateway.child('child2');
    await n.gateway.child('child3');
    await n.pump();
    expect(n.closed).toContain('child3');
    const open = n.wire.find((m) => m.type === 'relay-open');
    await expect(
      n.root.receive(
        'other-gateway',
        JSON.stringify(envelope({ type: 'relay-frame', route: open.route, data: '{}' })),
      ),
    ).rejects.toThrow('sconosciuto');
    await n.root.lost('gateway');
    expect(n.closed.filter((p) => p.startsWith('relay:'))).toHaveLength(2);
    await n.gateway.lost('root');
    expect(n.closed).toContain('child');
    expect(n.closed).toContain('child2');
  });
  it('non autorizza ponti anonimi, percorsi annidati e messaggi in chiaro', async () => {
    const relay = new Relay({
      random,
      wire: async () => {},
      close: async () => {},
      event: async () => {},
      disconnected: async () => {},
      status: () => {},
      ready: async () => {},
      approved: () => false,
    });
    relay.rootIdentity(tunnelKeys(random));
    await expect(
      relay.receive('stranger', JSON.stringify(envelope({ type: 'relay-open', route: random() }))),
    ).rejects.toThrow('approvato');
    const n = network();
    await n.gateway.child('child');
    await n.pump();
    await expect(
      n.gateway.receive('child', JSON.stringify(envelope({ type: 'hello', nickname: 'Chiaro' }))),
    ).rejects.toThrow('cifrati');
    await n.child.begin('gateway');
    await n.pump();
    expect(() => n.child.setEnabled(true, 'gateway')).toThrow('diretto');
  });
});
