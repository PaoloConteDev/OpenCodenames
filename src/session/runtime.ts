import Link, { HostInfo, LinkEvent, Mode } from '../../modules/offline-link';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { Action, PlayStyle, View, ensure } from '../core/model';
import { Authority, HostStore, Mode as SessionMode } from './authority';
import {
  Command,
  Credentials,
  command,
  hello,
  parse,
  envelope,
  VersionMismatchError,
} from '../protocol/messages';
import { fingerprint, tunnelKeys } from '../protocol/secure-tunnel';
import { Relay } from './relay';
import { mergeDevice, NearbyDevice } from './discovery';
import { isLanguage, languageFromLocale, type Language } from '../content/languages';

function deviceLanguage(): Language {
  try {
    return languageFromLocale(Link.systemLanguage());
  } catch {
    return 'en';
  }
}

export type Endpoint = {
  mode: Mode;
  address: string;
  port: number;
  roomCode: string;
  nickname: string;
  viaRelay?: boolean;
};
export type ClientStore = {
  schema: 1;
  endpoint: Endpoint;
  credentials: Credentials;
  hostPublicKey?: string;
  resumeOnLaunch?: boolean;
};
export type Settings = { sound: boolean; haptic: boolean; language?: Language };
export type RuntimeState = {
  view: View | null;
  ownId: string;
  isHost: boolean;
  mode: SessionMode;
  status: string;
  error: string;
  busy: boolean;
  pending: { peer: string; nickname: string }[];
  nearby: NearbyDevice[];
  discoveryStage: 'scan' | 'services';
  relayEnabled: boolean;
  relayChildren: number;
  waitingFingerprint: string;
  hostFingerprint: string;
  viaRelay: boolean;
  hostInfo: HostInfo | null;
  roomCode: string;
  diagnostics: string[];
  settings: Settings;
  savedHost: boolean;
  savedClient: boolean;
  active: boolean;
  scanning: boolean;
  hostTimeOffset: number;
};
type Peer = {
  playerId?: string;
  lastSeen: number;
  created: number;
  hello: boolean;
  count: number;
  window: number;
};

export async function bluetoothPermission(host: boolean) {
  ensure(Platform.OS === 'android', 'È richiesta una build Android dedicata');
  const permissions =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          ...(host ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE] : []),
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(permissions);
  ensure(
    permissions.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED),
    'Permessi Bluetooth negati. Abilita Dispositivi vicini (o Posizione fino ad Android 11) nelle impostazioni dell’app.',
  );
}

export class Runtime {
  private state: RuntimeState = {
    view: null,
    ownId: '',
    isHost: false,
    mode: 'bluetooth',
    status: 'Pronto',
    error: '',
    busy: false,
    pending: [],
    nearby: [],
    hostInfo: null,
    roomCode: '',
    diagnostics: [],
    settings: { sound: false, haptic: true, language: deviceLanguage() },
    savedHost: false,
    savedClient: false,
    active: false,
    scanning: false,
    discoveryStage: 'scan',
    hostTimeOffset: 0,
    relayEnabled: false,
    relayChildren: 0,
    waitingFingerprint: '',
    hostFingerprint: '',
    viaRelay: false,
  };
  private subscribers = new Set<() => void>();
  private authority: Authority | null = null;
  private client: ClientStore | null = null;
  private endpoint: Endpoint | null = null;
  private hostPeer: string | null = null;
  private peers = new Map<string, Peer>();
  private outbox = new Map<string, Promise<unknown>>();
  private inbound: Promise<unknown> = Promise.resolve();
  private reconnectAt = 0;
  private connecting = false;
  private foreground = true;
  private stopped = false;
  private versionBlocked = false;
  private ticking = false;
  private relayWanted = false;
  private synchronized = false;
  private lifecycle: Promise<void> = Promise.resolve();
  private transportGeneration = 0;
  private nextHeartbeatAt = 0;
  private awaiting: { cmd: Command; at: number; retried: boolean } | null = null;
  private storage = { save: (data: HostStore) => Link.writeStore('host', JSON.stringify(data)) };
  private relay = new Relay({
    random: () => Link.token(),
    wire: (peer, message) => this.wireSend(peer, message),
    close: (peer) => Link.close(peer),
    event: (peer, text) =>
      this.event({ type: text === undefined ? 'connected' : 'message', peer, text }),
    disconnected: (peer) => this.event({ type: 'disconnected', peer }),
    approved: (peer) => !!this.peers.get(peer)?.playerId,
    status: (waitingFingerprint, relayChildren) =>
      this.update({ waitingFingerprint, relayChildren }),
    ready: () => this.helloHost(),
  });
  constructor() {
    Link.addListener('link', (e) => {
      this.inbound = this.inbound.then(() => this.event(e)).catch((e) => this.fail(e));
    });
    AppState.addEventListener('change', (next) => {
      const foreground = next === 'active';
      if (foreground === this.foreground) return;
      this.foreground = foreground;
      this.lifecycle = this.lifecycle
        .catch(() => undefined)
        .then(async () => {
          if (!this.state.active) return;
          if (foreground) await this.resumeTransport();
          else await this.pause();
        })
        .catch((e) => this.fail(e));
    });
    setInterval(() => {
      if (!this.ticking) {
        this.ticking = true;
        void this.tick()
          .catch((e) => this.fail(e))
          .finally(() => {
            this.ticking = false;
          });
      }
    }, 1000);
  }
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  };
  private update(patch: Partial<RuntimeState>) {
    this.state = { ...this.state, ...patch };
    this.subscribers.forEach((fn) => fn());
  }
  private log(message: string) {
    this.update({
      diagnostics: [
        ...this.state.diagnostics,
        `${new Date().toLocaleTimeString('it-IT')}  ${message}`,
      ].slice(-40),
    });
  }
  private fail(e: unknown) {
    this.update({ error: e instanceof Error ? e.message : 'Operazione non riuscita', busy: false });
  }
  clearError() {
    this.update({ error: '' });
  }
  reportError(message: string) {
    this.fail(new Error(message));
  }
  async initialize() {
    const [host, client, settings] = await Promise.all(
      ['host', 'client', 'settings'].map((k) => Link.readStore(k)),
    );
    this.update({
      savedHost: !!host && host !== 'null',
      savedClient: !!client && client !== 'null',
    });
    let savedSettings: Partial<Settings> = {};
    try {
      const parsed: unknown = settings ? JSON.parse(settings) : null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        savedSettings = parsed as Partial<Settings>;
    } catch {
      // Recover missing/unreadable preferences without changing saved games.
    }
    const resolvedSettings: Settings = {
      sound: savedSettings.sound === true,
      haptic: savedSettings.haptic !== false,
      language: isLanguage(savedSettings.language) ? savedSettings.language : deviceLanguage(),
    };
    if (!isLanguage(savedSettings.language)) await this.settings(resolvedSettings);
    else this.update({ settings: resolvedSettings });
    if (client && client !== 'null') {
      const saved: ClientStore = JSON.parse(client);
      if (saved.schema === 1 && saved.resumeOnLaunch === true)
        await this.join(saved.endpoint, true);
    }
  }
  async settings(settings: Settings) {
    await Link.writeStore('settings', JSON.stringify(settings));
    this.update({ settings });
  }
  private async send(peer: string, message: object) {
    if (this.authority && ['state', 'welcome'].includes((message as { type: string }).type))
      message = { ...message, hostTime: Date.now() };
    if (await this.relay.send(peer, message)) return;
    await this.wireSend(peer, message);
  }
  private async wireSend(peer: string, message: object) {
    const previous = this.outbox.get(peer) || Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => Link.send(peer, JSON.stringify(envelope(message))));
    this.outbox.set(peer, next);
    try {
      await next;
    } finally {
      if (this.outbox.get(peer) === next) this.outbox.delete(peer);
    }
  }
  private async close(peer: string) {
    if (await this.relay.close(peer)) return;
    await Link.close(peer);
  }
  private localView() {
    if (this.authority) this.update({ view: this.authority.view(this.authority.data.game.hostId) });
  }
  private async broadcast() {
    const a = this.authority;
    if (!a) return;
    this.localView();
    await Promise.all(
      [...this.peers].map(async ([peer, p]) => {
        if (!p.playerId) return;
        if (!a.data.game.players.some((x) => x.id === p.playerId)) {
          await this.send(peer, {
            type: 'rejected',
            error: 'Sei stato rimosso dalla stanza',
          }).catch(() => undefined);
          await this.close(peer);
          return;
        }
        await this.send(peer, { type: 'state', view: a.view(p.playerId) }).catch(() =>
          this.close(peer),
        );
      }),
    );
  }
  async host(
    nickname: string,
    mode: SessionMode,
    restore = false,
    turnSeconds: number | null = null,
    playStyle: PlayStyle = 'classic',
  ) {
    this.versionBlocked = false;
    await this.clearClientIntent();
    this.relayWanted = false;
    this.update({ busy: true, error: '', status: 'Apertura stanza…' });
    this.stopped = false;
    let restored: HostStore | null = null;
    if (restore) {
      const saved = await Link.readStore('host');
      ensure(saved && saved !== 'null', 'Nessuna stanza salvata');
      const data: HostStore = JSON.parse(saved);
      ensure(data.schema === 1 && data.game.schema === 1, 'Salvataggio incompatibile');
      restored = data;
      mode = data.mode;
      playStyle = data.game.playStyle ?? 'classic';
    }
    mode = playStyle === 'single' ? 'local' : mode;
    ensure(
      mode !== 'local' || playStyle === 'single',
      'Il trasporto locale richiede Unico dispositivo',
    );
    if (mode === 'bluetooth') await bluetoothPermission(true);
    await this.resetTransport();
    if (restored) {
      this.authority = new Authority(
        restored,
        this.storage,
        () => Link.token(),
        (n) => Link.randomInt(n),
      );
      await this.authority.recover();
    } else {
      this.authority = Authority.create(
        nickname,
        mode,
        () => Link.token(),
        (n) => Link.randomInt(n),
        this.storage,
        turnSeconds,
        playStyle,
        languageFromLocale(this.state.settings.language),
      );
      await this.authority.save();
    }
    const a = this.authority;
    const identity =
      mode === 'local' ? null : await a.relayIdentity(() => tunnelKeys(() => Link.token()));
    if (identity) this.relay.rootIdentity(identity);
    this.client = null;
    this.update({
      ownId: a.data.game.hostId,
      isHost: true,
      mode,
      roomCode: a.data.roomCode,
      active: true,
      savedHost: true,
      hostFingerprint: identity ? fingerprint(identity.publicKey) : '',
      viaRelay: false,
      hostTimeOffset: 0,
    });
    this.localView();
    try {
      const hostInfo = mode === 'local' ? null : await Link.startHost(mode);
      await a.resumeClock();
      this.localView();
      this.update({
        hostInfo,
        busy: false,
        status:
          mode === 'local'
            ? 'Unico dispositivo · partita sul telefono'
            : 'Stanza aperta · in attesa di partecipanti',
      });
      if (mode === 'bluetooth') await Link.discoverable();
      this.log(
        mode === 'local'
          ? 'Unico dispositivo avviato · nessun trasporto di rete'
          : 'Host avviato · trasporto nativo',
      );
    } catch (e) {
      this.fail(e);
      this.update({ status: 'Hosting sospeso · premi Riprendi' });
      throw e;
    }
  }
  async discover() {
    await bluetoothPermission(false);
    this.update({ nearby: [], scanning: true, discoveryStage: 'scan', error: '' });
    try {
      await Link.discover();
    } catch (e) {
      this.update({ scanning: false });
      throw e;
    }
  }
  async visible() {
    await bluetoothPermission(true);
    await Link.discoverable();
  }
  async stopDiscovery() {
    await Link.stopDiscovery();
    this.update({ scanning: false });
  }
  async join(endpoint: Endpoint, restore = false) {
    this.versionBlocked = false;
    this.relayWanted = false;
    this.stopped = false;
    this.update({ error: '', busy: true, scanning: false });
    let restored: ClientStore | null = null;
    if (restore) {
      const saved = await Link.readStore('client');
      ensure(saved && saved !== 'null', 'Nessuna sessione salvata');
      const client: ClientStore = JSON.parse(saved);
      ensure(client.schema === 1, 'Sessione incompatibile');
      restored = client;
      endpoint = client.endpoint;
    }
    if (endpoint.mode === 'bluetooth') await bluetoothPermission(false);
    await this.resetTransport();
    this.authority = null;
    this.client = restored;
    this.endpoint = endpoint;
    this.update({
      isHost: false,
      mode: endpoint.mode,
      view: null,
      ownId: this.client?.credentials.playerId || '',
      active: true,
      roomCode: endpoint.roomCode,
      viaRelay: endpoint.viaRelay === true,
      hostFingerprint: '',
    });
    await this.connect();
  }
  private async connect() {
    if (this.connecting || !this.endpoint || !this.foreground || this.stopped) return;
    this.connecting = true;
    this.synchronized = false;
    const generation = this.transportGeneration;
    this.update({ status: 'Connessione all’host…', busy: true });
    try {
      const peer = await Link.connect(
        this.endpoint.mode,
        this.endpoint.address,
        this.endpoint.port,
        this.endpoint.viaRelay === true,
      );
      if (generation !== this.transportGeneration) {
        await Link.close(peer);
        return;
      }
      this.hostPeer = peer;
      if (this.endpoint.viaRelay) await this.relay.begin(peer, this.client?.hostPublicKey);
      else await this.helloHost();
      this.update({
        status: this.client ? 'Recupero della sessione…' : 'Attendi l’approvazione dell’host',
        busy: true,
      });
    } catch (e) {
      if (generation !== this.transportGeneration) return;
      this.reconnectAt = Date.now() + 10000;
      this.fail(e);
      this.update({ status: 'Host non raggiungibile · riconnessione automatica' });
    } finally {
      if (generation === this.transportGeneration) this.connecting = false;
    }
  }
  private async helloHost() {
    ensure(this.hostPeer && this.endpoint, 'Host assente');
    await this.send(this.hostPeer, {
      type: 'hello',
      nickname: this.endpoint.nickname,
      roomCode: this.endpoint.roomCode,
      ...(this.client ? { resume: this.client.credentials } : {}),
    });
  }
  async confirmRelayHost() {
    await this.relay.confirm();
  }
  async setRelay(enabled: boolean) {
    ensure(
      !this.authority &&
        this.hostPeer &&
        this.client &&
        this.state.mode === 'bluetooth' &&
        !this.endpoint?.viaRelay,
      'Il ponte richiede un partecipante Bluetooth approvato e collegato direttamente all’host',
    );
    if (enabled) {
      await bluetoothPermission(true);
      await Link.startRelay();
      this.relayWanted = true;
      this.relay.setEnabled(true, this.hostPeer);
      this.update({ relayEnabled: true });
      await Link.discoverable();
    } else {
      this.relayWanted = false;
      this.relay.setEnabled(false);
      await Link.stopRelay();
      this.update({ relayEnabled: false });
    }
  }
  async approve(peer: string, accepted: boolean) {
    const a = this.authority;
    ensure(a, 'Solo l’host può approvare');
    const request = this.state.pending.find((x) => x.peer === peer);
    ensure(request && this.peers.has(peer), 'Richiesta scaduta');
    this.update({ pending: this.state.pending.filter((x) => x.peer !== peer) });
    if (!accepted) {
      await this.send(peer, { type: 'rejected', error: 'Ingresso rifiutato dall’host' });
      await this.close(peer);
      return;
    }
    try {
      const credentials = await a.join(request.nickname);
      const connection = this.peers.get(peer);
      if (!connection) {
        await a.presence(credentials.playerId, false);
        await this.broadcast();
        return;
      }
      connection.playerId = credentials.playerId;
      await this.send(peer, {
        type: 'welcome',
        credentials,
        view: a.view(credentials.playerId),
        hostPublicKey: a.data.relayIdentity?.publicKey,
      });
      this.log('Partecipante approvato');
      await this.broadcast();
    } catch (error) {
      await this.send(peer, {
        type: 'rejected',
        error: error instanceof Error ? error.message : 'Ingresso non riuscito',
      }).catch(() => undefined);
      await this.close(peer);
      throw error;
    }
  }
  async act(action: Action) {
    ensure(this.state.view && !this.awaiting, 'Attendi la sincronizzazione del comando precedente');
    ensure(this.state.active && this.foreground, 'Riprendi la connessione');
    ensure(
      this.authority || this.synchronized,
      'Sincronizzazione in corso: attendi lo stato aggiornato',
    );
    this.update({ error: '' });
    const cmd: Command = {
      v: 1,
      type: 'command',
      id: Link.token(),
      gameId: this.state.view.id,
      version: this.state.view.version,
      action,
    };
    if (this.authority) {
      this.update({ busy: true });
      try {
        const receipt = await this.authority.execute(this.state.ownId, cmd);
        await this.broadcast();
        ensure(receipt.ok, receipt.error || 'Comando rifiutato');
        if (action.type === 'probe') this.log(`ECO LOCALE: ${action.text}`);
      } finally {
        this.update({ busy: false });
      }
    } else {
      ensure(this.hostPeer, 'Connessione assente. Attendi l’host');
      this.awaiting = { cmd, at: Date.now(), retried: false };
      this.update({ busy: true });
      try {
        await this.send(this.hostPeer, cmd);
      } catch (e) {
        this.awaiting = null;
        this.update({ busy: false });
        throw e;
      }
    }
  }
  private async event(e: LinkEvent) {
    if ((e.type === 'host' || e.type === 'device') && e.address) {
      this.update({
        nearby: mergeDevice(this.state.nearby, { ...e, address: e.address }),
      });
      return;
    }
    if (e.type === 'discoveryStage' && e.stage) {
      this.update({ discoveryStage: e.stage });
      return;
    }
    if (e.type === 'discoveryFinished') {
      this.update({ scanning: false });
      return;
    }
    if (e.type === 'error') {
      this.update({ status: 'Collegamento sospeso', error: e.message || 'Errore collegamento' });
      return;
    }
    if (!e.peer) return;
    const peer = e.peer;
    if (e.type === 'connected') {
      if (this.authority?.data.game.playStyle === 'single') {
        await Link.close(peer);
        return;
      }
      if (!this.authority && !e.client && !peer.startsWith('relay:')) {
        if (this.state.relayEnabled) await this.relay.child(peer);
        else await Link.close(peer);
        return;
      }
      this.peers.set(peer, {
        created: Date.now(),
        lastSeen: Date.now(),
        hello: false,
        count: 0,
        window: Date.now(),
      });
      this.log('Socket collegato');
      return;
    }
    if (e.type === 'disconnected') {
      await this.relay.lost(peer);
      const p = this.peers.get(peer);
      this.peers.delete(peer);
      this.update({ pending: this.state.pending.filter((x) => x.peer !== peer) });
      if (
        this.authority &&
        p?.playerId &&
        ![...this.peers.values()].some((x) => x.playerId === p.playerId)
      ) {
        await this.authority.presence(p.playerId, false);
        await this.broadcast();
      }
      if (peer === this.hostPeer) {
        this.synchronized = false;
        if (this.state.relayEnabled) await Link.stopRelay();
        this.hostPeer = null;
        this.awaiting = null;
        this.reconnectAt = Date.now() + 3000;
        this.update({
          busy: false,
          status: this.versionBlocked
            ? 'Versioni incompatibili · installate la stessa versione'
            : 'Host assente · partita in attesa',
        });
        this.update({ relayEnabled: false, waitingFingerprint: '' });
      }
      this.log('Socket scollegato');
      return;
    }
    if (e.type !== 'message' || !e.text || this.stopped) return;
    if (this.relay.childPeers.includes(peer)) {
      try {
        await this.relay.receive(peer, e.text);
      } catch (err) {
        if (err instanceof VersionMismatchError)
          await this.wireSend(peer, {
            type: 'rejected',
            code: 'VERSION_MISMATCH',
            error: err.message,
          }).catch(() => undefined);
        await Link.close(peer);
      }
      return;
    }
    const p = this.peers.get(peer);
    if (!p) return;
    p.lastSeen = Date.now();
    if (p.lastSeen - p.window >= 1000) {
      p.window = p.lastSeen;
      p.count = 0;
    }
    if (
      ++p.count > (!peer.startsWith('relay:') && (p.playerId || peer === this.hostPeer) ? 48 : 12)
    ) {
      await this.close(peer);
      return;
    }
    let m: Record<string, unknown>;
    try {
      const decoded = await this.relay.receive(peer, e.text);
      if (decoded === null) return;
      m = parse(decoded);
    } catch (err) {
      if (err instanceof VersionMismatchError) {
        if (peer === this.hostPeer) {
          this.versionBlocked = true;
          this.stopped = true;
          this.synchronized = false;
          this.awaiting = null;
          this.update({ view: null, waitingFingerprint: '', error: err.message, busy: false });
        } else {
          await this.send(peer, {
            type: 'rejected',
            code: 'VERSION_MISMATCH',
            error: err.message,
          }).catch(() => undefined);
          this.log('Collegamento rifiutato: versione app diversa');
        }
        await this.close(peer);
        if (this.versionBlocked)
          this.update({ status: 'Versioni incompatibili · installate la stessa versione' });
        return;
      }
      this.update({
        error: 'Protocollo o identità del ponte non validi: collegamento chiuso',
        busy: false,
      });
      await this.close(peer);
      return;
    }
    if (m.type === 'ping') {
      await this.send(peer, { type: 'pong' });
      return;
    }
    if (m.type === 'pong') return;
    if (this.authority) {
      const a = this.authority;
      try {
        if (m.type === 'hello') {
          ensure(!p.hello, 'Ingresso già richiesto');
          p.hello = true;
          const request = hello(m);
          if (request.resume) {
            const playerId = a.authenticate(request.resume);
            for (const [oldPeer, old] of this.peers)
              if (oldPeer !== peer && old.playerId === playerId) {
                old.playerId = undefined;
                await this.close(oldPeer);
              }
            p.playerId = playerId;
            await a.presence(playerId, true);
            await this.send(peer, {
              type: 'welcome',
              credentials: request.resume,
              view: a.view(playerId),
              hostPublicKey: a.data.relayIdentity?.publicKey,
            });
            this.log('Sessione recuperata');
            await this.broadcast();
          } else {
            ensure(
              a.data.mode === 'bluetooth' || request.roomCode === a.data.roomCode,
              'Codice stanza errato',
            );
            ensure(
              a.data.game.phase === 'lobby',
              'Partita iniziata: possono rientrare solo i partecipanti già approvati',
            );
            this.update({ pending: [...this.state.pending, { peer, nickname: request.nickname }] });
            await this.send(peer, { type: 'pending' });
          }
          return;
        }
        ensure(p.playerId, 'Attendi l’approvazione');
        const cmd = command(m);
        const receipt = await a.execute(p.playerId, cmd);
        await this.send(peer, { type: 'ack', receipt });
        if (cmd.action.type === 'probe' && receipt.ok) {
          this.log(`ECO RICEVUTO: ${cmd.action.text}`);
          await this.send(peer, { type: 'echo', text: cmd.action.text });
        }
        await this.broadcast();
      } catch (err) {
        await this.send(peer, {
          type: 'rejected',
          error: err instanceof Error ? err.message : 'Richiesta rifiutata',
        });
        if (!p.playerId) await this.close(peer);
      }
    } else if (peer === this.hostPeer) {
      if (m.type === 'welcome') {
        ensure(this.endpoint, 'Indirizzo mancante');
        const credentials = m.credentials as Credentials;
        const view = m.view as View;
        ensure(
          credentials?.gameId === view?.id &&
            view.players.some((x) => x.id === credentials.playerId),
          'Risposta host non valida',
        );
        if (this.client)
          ensure(
            credentials.gameId === this.client.credentials.gameId &&
              credentials.playerId === this.client.credentials.playerId,
            'Sessione diversa',
          );
        const hostPublicKey = this.endpoint.viaRelay
          ? this.relay.publicKey
          : typeof m.hostPublicKey === 'string' && /^[a-f0-9]{64}$/.test(m.hostPublicKey)
            ? m.hostPublicKey
            : undefined;
        this.client = {
          schema: 1,
          endpoint: this.endpoint,
          credentials,
          resumeOnLaunch: true,
          ...(hostPublicKey ? { hostPublicKey } : {}),
        };
        await Link.writeStore('client', JSON.stringify(this.client));
        this.synchronized = true;
        this.update({
          ownId: credentials.playerId,
          view,
          busy: false,
          savedClient: true,
          status: 'Connesso all’host',
          hostFingerprint: hostPublicKey ? fingerprint(hostPublicKey) : '',
          hostTimeOffset:
            typeof m.hostTime === 'number' && Number.isFinite(m.hostTime)
              ? m.hostTime - Date.now()
              : 0,
        });
        this.log('Sessione sincronizzata');
        if (
          this.relayWanted &&
          !this.endpoint.viaRelay &&
          this.state.mode === 'bluetooth' &&
          !this.state.relayEnabled
        ) {
          await Link.startRelay();
          this.relay.setEnabled(true, this.hostPeer!);
          this.update({ relayEnabled: true });
        }
      } else if (m.type === 'state') {
        const view = m.view as View;
        if (
          this.client &&
          view.id === this.client.credentials.gameId &&
          (!this.state.view || view.version >= this.state.view.version)
        )
          this.update({
            view,
            status: 'Connesso all’host',
            hostTimeOffset:
              typeof m.hostTime === 'number' && Number.isFinite(m.hostTime)
                ? m.hostTime - Date.now()
                : this.state.hostTimeOffset,
          });
      } else if (m.type === 'ack') {
        const r = m.receipt as { id: string; ok: boolean; error?: string };
        if (this.awaiting?.cmd.id === r.id) {
          this.awaiting = null;
          this.update({ busy: false, error: r.ok ? '' : r.error || 'Comando rifiutato' });
        }
      } else if (m.type === 'rejected') {
        this.awaiting = null;
        this.update({ error: String(m.error), busy: false });
        if (!this.state.view || String(m.error).includes('rimosso')) {
          await this.clearClientIntent();
          this.stopped = true;
          this.update({ status: 'Ingresso rifiutato · torna alla Home per riprovare' });
        }
      } else if (m.type === 'pending')
        this.update({ status: 'Richiesta inviata · attendi l’host' });
      else if (m.type === 'echo') this.log(`ECO DALL’HOST: ${String(m.text)}`);
    }
  }
  private async tick() {
    if (!this.state.active || !this.foreground || this.stopped) return;
    const now = Date.now();
    if (this.authority && (await this.authority.advanceClock())) await this.broadcast();
    const heartbeat = now >= this.nextHeartbeatAt;
    if (heartbeat) this.nextHeartbeatAt = now + 2000;
    for (const [peer, p] of this.peers) {
      if (peer === this.hostPeer && this.relay.waiting) continue;
      if (peer.startsWith('relay:') && !p.hello) {
        if (now - p.created > 120000) await this.close(peer);
        continue;
      }
      if (now - p.lastSeen > 20000 || (this.authority && !p.playerId && now - p.created > 120000)) {
        await this.close(peer);
        continue;
      }
      if (heartbeat) await this.send(peer, { type: 'ping' }).catch(() => this.close(peer));
    }
    if (this.awaiting && now - this.awaiting.at > 8000) {
      this.awaiting = null;
      this.update({
        busy: false,
        error:
          'Conferma non ricevuta: recupero lo stato. Controlla la partita prima di ripetere l’azione.',
      });
      if (this.hostPeer && this.state.view)
        await this.send(this.hostPeer, {
          v: 1,
          type: 'command',
          gameId: this.state.view.id,
          id: Link.token(),
          version: this.state.view.version,
          action: { type: 'sync' },
        });
    } else if (
      this.awaiting &&
      !this.awaiting.retried &&
      now - this.awaiting.at > 2500 &&
      this.hostPeer
    ) {
      this.awaiting.retried = true;
      await this.send(this.hostPeer, this.awaiting.cmd).catch(() => undefined);
    }
    if (!this.authority && !this.hostPeer && this.client && now >= this.reconnectAt)
      await this.connect();
  }
  private async resetTransport() {
    this.transportGeneration++;
    this.synchronized = false;
    this.connecting = false;
    this.hostPeer = null;
    this.awaiting = null;
    this.peers.clear();
    this.relay.clear();
    this.update({ pending: [], relayEnabled: false, waitingFingerprint: '' });
    await Link.stop();
  }
  private async pause() {
    if (this.authority) await this.authority.pauseClock();
    await this.resetTransport();
    if (this.authority) {
      if (this.authority.data.relayIdentity)
        this.relay.rootIdentity(this.authority.data.relayIdentity);
      await this.authority.recover();
      this.localView();
    }
    this.update({
      status: this.authority
        ? this.state.mode === 'local'
          ? 'Partita in pausa · ripresa al ritorno'
          : 'Host sospeso · ripresa al ritorno'
        : 'In background · sincronizzazione automatica al rientro',
      busy: false,
    });
  }
  async resumeTransport() {
    if (this.versionBlocked) return;
    this.stopped = false;
    if (this.authority) {
      if (this.authority.data.relayIdentity)
        this.relay.rootIdentity(this.authority.data.relayIdentity);
      if (this.state.mode === 'bluetooth') await bluetoothPermission(true);
      const hostInfo = this.state.mode === 'local' ? null : await Link.startHost(this.state.mode);
      await this.authority.resumeClock();
      this.localView();
      this.update({
        hostInfo,
        status:
          this.state.mode === 'local'
            ? 'Unico dispositivo · partita sul telefono'
            : 'Host disponibile · attendo i partecipanti',
        error: '',
        busy: false,
      });
    } else if (this.endpoint) {
      await this.resetTransport();
      await this.connect();
    }
  }
  async leave() {
    await this.clearClientIntent();
    this.relayWanted = false;
    this.stopped = true;
    this.update({ active: false });
    await this.pause();
    this.authority = null;
    this.client = null;
    this.endpoint = null;
    this.update({
      view: null,
      ownId: '',
      isHost: false,
      status: 'Pronto',
      error: '',
      hostInfo: null,
      busy: false,
    });
  }
  private async clearClientIntent() {
    const saved = await Link.readStore('client');
    if (!saved || saved === 'null') return;
    const client: ClientStore = JSON.parse(saved);
    if (client.resumeOnLaunch === true) {
      client.resumeOnLaunch = false;
      await Link.writeStore('client', JSON.stringify(client));
    }
  }
}
export const runtime = new Runtime();
