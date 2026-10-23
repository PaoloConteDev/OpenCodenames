import { ensure, MAX_RELAY_CHILDREN } from '../core/model';
import { id, parse, envelope } from '../protocol/messages';
import {
  bytes,
  fingerprint,
  SecureTunnel,
  TunnelKeys,
  tunnelKeys,
} from '../protocol/secure-tunnel';

type Route = { parent: string; route: string; tunnel?: SecureTunnel };
type IO = {
  random(): string;
  wire(peer: string, message: object): Promise<void>;
  close(peer: string): Promise<void>;
  event(peer: string, text?: string): Promise<void>;
  disconnected(peer: string): Promise<void>;
  approved(peer: string): boolean;
  status(fingerprint: string, children: number): void;
  ready(): Promise<void>;
};
/** One hop only. A relay forwards opaque frames; identities and game authority stay at the host. */
export class Relay {
  private root?: TunnelKeys;
  private routes = new Map<string, Route>();
  private children = new Map<string, string>();
  private enabled = false;
  private host?: string;
  private ephemeral?: TunnelKeys;
  private tunnel?: SecureTunnel;
  private pinned?: string;
  private candidate?: string;
  private confirmed = false;
  constructor(private io: IO) {}
  clear() {
    this.root = undefined;
    this.routes.clear();
    this.children.clear();
    this.enabled = false;
    this.host = undefined;
    this.ephemeral = undefined;
    this.tunnel = undefined;
    this.candidate = undefined;
    this.pinned = undefined;
    this.confirmed = false;
    this.io.status('', 0);
  }
  rootIdentity(keys: TunnelKeys) {
    this.root = keys;
  }
  get publicKey() {
    return this.candidate;
  }
  get waiting() {
    return !!this.ephemeral && !this.confirmed;
  }
  get childPeers() {
    return [...this.children.keys()];
  }
  async begin(host: string, pinned?: string) {
    this.host = host;
    this.pinned = pinned;
    this.candidate = undefined;
    this.confirmed = false;
    this.ephemeral = tunnelKeys(this.io.random);
    this.tunnel = undefined;
    await this.io.wire(host, { type: 'tunnel-hello', publicKey: this.ephemeral.publicKey });
  }
  async confirm() {
    ensure(this.tunnel && this.candidate && !this.confirmed, 'Impronta host non disponibile');
    this.confirmed = true;
    this.io.status('', this.children.size);
    await this.io.ready();
  }
  setEnabled(enabled: boolean, host?: string) {
    ensure(
      !enabled || (!this.root && !this.ephemeral && host),
      'Il ponte richiede un collegamento diretto all’host',
    );
    this.enabled = enabled;
    if (host) this.host = host;
  }
  async child(peer: string) {
    if (!this.enabled || !this.host || this.children.size >= MAX_RELAY_CHILDREN) {
      await this.io.close(peer);
      return;
    }
    const route = this.io.random();
    this.children.set(peer, route);
    await this.io.wire(this.host, { type: 'relay-open', route });
    this.io.status('', this.children.size);
  }
  async lost(peer: string) {
    const route = this.children.get(peer);
    if (route) {
      this.children.delete(peer);
      if (this.host)
        await this.io.wire(this.host, { type: 'relay-close', route }).catch(() => undefined);
      this.io.status('', this.children.size);
    }
    for (const [virtual, r] of [...this.routes])
      if (r.parent === peer) {
        this.routes.delete(virtual);
        await this.io.disconnected(virtual);
      }
    if (peer === this.host) {
      this.host = undefined;
      this.tunnel = undefined;
      this.candidate = undefined;
      this.confirmed = false;
      this.enabled = false;
      const children = this.childPeers;
      this.children.clear();
      for (const child of children) await this.io.close(child);
      this.io.status('', 0);
    }
  }
  async close(peer: string): Promise<boolean> {
    const r = this.routes.get(peer);
    if (!r) return false;
    this.routes.delete(peer);
    await this.io.wire(r.parent, { type: 'relay-close', route: r.route }).catch(() => undefined);
    await this.io.disconnected(peer);
    return true;
  }
  async send(peer: string, message: object): Promise<boolean> {
    const r = this.routes.get(peer);
    if (r) {
      ensure(r.tunnel, 'Tunnel del partecipante non pronto');
      await this.io.wire(r.parent, {
        type: 'relay-frame',
        route: r.route,
        data: JSON.stringify(envelope(r.tunnel.seal(JSON.stringify(envelope(message))))),
      });
      return true;
    }
    if (peer === this.host && this.ephemeral) {
      // Do not send credentials, commands or game data before the human key check.
      if (!this.confirmed) return true;
      ensure(this.tunnel, 'Tunnel non disponibile');
      await this.io.wire(peer, this.tunnel.seal(JSON.stringify(envelope(message))));
      return true;
    }
    return false;
  }
  async receive(peer: string, text: string): Promise<string | null> {
    const m = parse(text);
    const childRoute = this.children.get(peer);
    if (childRoute) {
      ensure(
        m.type === 'tunnel-hello' || m.type === 'tunnel-data',
        'Sono ammessi solo messaggi cifrati attraverso il ponte',
      );
      ensure(this.host, 'Host assente');
      await this.io.wire(this.host, { type: 'relay-frame', route: childRoute, data: text });
      return null;
    }
    const r = this.routes.get(peer);
    if (r) {
      if (m.type === 'tunnel-hello') {
        ensure(!r.tunnel && this.root, 'Tunnel già aperto');
        bytes(m.publicKey, 32);
        r.tunnel = new SecureTunnel(this.root.secretKey, m.publicKey as string, this.io.random);
        await this.io.wire(r.parent, {
          type: 'relay-frame',
          route: r.route,
          data: JSON.stringify(envelope({ type: 'tunnel-key', publicKey: this.root.publicKey })),
        });
        return null;
      }
      ensure(r.tunnel, 'Prima apri il tunnel cifrato');
      return r.tunnel.open(m);
    }
    if (this.root && String(m.type).startsWith('relay-')) {
      ensure(this.io.approved(peer), 'Solo un partecipante approvato può fare da ponte');
      const route = id(m.route);
      const virtual = `relay:${peer}:${route}`;
      if (m.type === 'relay-open') {
        ensure(!this.routes.has(virtual), 'Percorso del ponte già aperto');
        ensure(
          [...this.routes.values()].filter((r) => r.parent === peer).length < MAX_RELAY_CHILDREN,
          'Ponte pieno',
        );
        this.routes.set(virtual, { parent: peer, route });
        await this.io.event(virtual);
        return null;
      }
      ensure(this.routes.has(virtual), 'Percorso del ponte sconosciuto');
      if (m.type === 'relay-close') {
        this.routes.delete(virtual);
        await this.io.disconnected(virtual);
        return null;
      }
      ensure(m.type === 'relay-frame' && typeof m.data === 'string', 'Messaggio ponte non valido');
      await this.io.event(virtual, m.data);
      return null;
    }
    if (peer === this.host && this.enabled && String(m.type).startsWith('relay-')) {
      const route = id(m.route);
      const child = [...this.children].find(([, r]) => r === route)?.[0];
      ensure(child, 'Percorso del ponte sconosciuto');
      if (m.type === 'relay-close') {
        this.children.delete(child);
        await this.io.close(child);
        this.io.status('', this.children.size);
      } else {
        ensure(
          m.type === 'relay-frame' && typeof m.data === 'string',
          'Messaggio ponte non valido',
        );
        const inner = parse(m.data);
        ensure(
          inner.type === 'tunnel-key' || inner.type === 'tunnel-data',
          'Risposta ponte non valida',
        );
        await this.io.wire(child, inner);
      }
      return null;
    }
    if (peer === this.host && this.ephemeral) {
      if (m.type === 'tunnel-key') {
        ensure(!this.candidate, 'Identità host già ricevuta');
        bytes(m.publicKey, 32);
        ensure(
          !this.pinned || this.pinned === m.publicKey,
          'Identità host cambiata: non inviare credenziali. Verifica il telefono host.',
        );
        this.candidate = m.publicKey as string;
        this.tunnel = new SecureTunnel(this.ephemeral.secretKey, this.candidate, this.io.random);
        if (this.pinned) await this.confirm();
        else this.io.status(fingerprint(this.candidate), 0);
        return null;
      }
      ensure(this.tunnel && this.confirmed, 'Conferma prima l’impronta dell’host');
      return this.tunnel.open(m);
    }
    ensure(
      !String(m.type).startsWith('relay-') && !String(m.type).startsWith('tunnel-'),
      'Percorso ponte non autorizzato',
    );
    return text;
  }
}
