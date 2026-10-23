import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinkEvent } from '../modules/offline-link';
import type { Runtime } from '../src/session/runtime';
import { randomBytes } from 'node:crypto';
import { SecureTunnel, tunnelKeys } from '../src/protocol/secure-tunnel';
import { APP_VERSION, envelope } from '../src/protocol/messages';
const mock = vi.hoisted(() => ({
  listener: null as null | ((e: LinkEvent) => void),
  stores: new Map<string, string>(),
  sent: [] as { peer: string; message: Record<string, any> }[],
  closed: [] as string[],
  serial: 100,
  appState: null as null | ((s: string) => void),
  relayStarts: 0,
  relayStops: 0,
  nativeStarts: 0,
  permissionRequests: 0,
  connectionCalls: 0,
  systemLocale: 'en-US',
  systemLocaleFailure: false,
}));
vi.mock('../modules/offline-link', () => ({
  default: {
    addListener: (_: string, fn: (e: LinkEvent) => void) => {
      mock.listener = fn;
    },
    token: () => randomBytes(32).toString('hex'),
    randomInt: () => 0,
    systemLanguage: () => {
      if (mock.systemLocaleFailure) throw new Error('Locale non disponibile');
      return mock.systemLocale;
    },
    readStore: async (key: string) => mock.stores.get(key) ?? null,
    writeStore: async (key: string, value: string) => {
      mock.stores.set(key, value);
    },
    startHost: async () => {
      mock.nativeStarts++;
      return { name: 'Test host', addresses: ['192.168.1.2'], port: 42831 };
    },
    discoverable: async () => {},
    discover: async () => {},
    stopDiscovery: async () => {},
    startRelay: async () => {
      mock.relayStarts++;
    },
    stopRelay: async () => {
      mock.relayStops++;
    },
    stop: async () => {},
    connect: async () => {
      mock.connectionCalls++;
      mock.listener?.({ type: 'connected', peer: 'host', client: true });
      return 'host';
    },
    close: async (peer: string) => {
      mock.closed.push(peer);
      mock.listener?.({ type: 'disconnected', peer });
    },
    send: async (peer: string, text: string) => {
      mock.sent.push({ peer, message: JSON.parse(text) });
    },
  },
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'android', Version: 36 },
  PermissionsAndroid: {
    PERMISSIONS: {
      BLUETOOTH_CONNECT: 'connect',
      BLUETOOTH_SCAN: 'scan',
      BLUETOOTH_ADVERTISE: 'advertise',
    },
    RESULTS: { GRANTED: 'granted' },
    requestMultiple: async (p: string[]) => {
      mock.permissionRequests++;
      return Object.fromEntries(p.map((x) => [x, 'granted']));
    },
  },
  AppState: {
    addEventListener: (_: string, fn: (s: string) => void) => {
      mock.appState = fn;
    },
  },
}));
async function drain() {
  for (let i = 0; i < 200; i++) await Promise.resolve();
}
async function emit(e: LinkEvent) {
  mock.listener?.(e);
  await drain();
}
async function message(peer: string, m: object) {
  await emit({ type: 'message', peer, text: JSON.stringify({ ...envelope(m), ...m }) });
}
function last(peer: string, type: string) {
  return mock.sent.filter((x) => x.peer === peer && x.message.type === type).at(-1)!.message;
}
let runtime: Runtime;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  mock.listener = null;
  mock.stores.clear();
  mock.sent = [];
  mock.closed = [];
  mock.relayStarts = 0;
  mock.relayStops = 0;
  mock.nativeStarts = 0;
  mock.permissionRequests = 0;
  mock.connectionCalls = 0;
  mock.systemLocale = 'en-US';
  mock.systemLocaleFailure = false;
  runtime = (await import('../src/session/runtime')).runtime;
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
describe('integrazione protocollo con I/O nativo sostituito solo nei test', () => {
  it.each([
    ['it-CH', 'it'],
    ['es-MX', 'es'],
    ['de-DE', 'de'],
    ['fr-CA', 'fr'],
    ['pt-BR', 'en'],
  ])('primo avvio: rileva %s e salva %s senza aprire la rete', async (locale, expected) => {
    mock.systemLocale = locale!;
    await runtime.initialize();
    expect(runtime.snapshot().settings.language).toBe(expected);
    expect(JSON.parse(mock.stores.get('settings')!).language).toBe(expected);
    expect(mock.nativeStarts).toBe(0);
    expect(mock.permissionRequests).toBe(0);
  });
  it('una scelta manuale e il primo rilevamento salvato prevalgono sui successivi cambi di sistema', async () => {
    mock.systemLocale = 'es-AR';
    await runtime.initialize();
    mock.systemLocale = 'de-DE';
    await runtime.initialize();
    expect(runtime.snapshot().settings.language).toBe('es');
    await runtime.settings({ ...runtime.snapshot().settings, language: 'fr' });
    mock.systemLocale = 'it-IT';
    await runtime.initialize();
    expect(runtime.snapshot().settings.language).toBe('fr');
    expect(JSON.parse(mock.stores.get('settings')!).language).toBe('fr');
  });
  it('le preferenze precedenti senza lingua mantengono suono e vibrazione usando la lingua di sistema', async () => {
    mock.systemLocale = 'de-AT';
    mock.stores.set('settings', JSON.stringify({ sound: true, haptic: false }));
    await runtime.initialize();
    expect(runtime.snapshot().settings).toEqual({ sound: true, haptic: false, language: 'de' });
    expect(JSON.parse(mock.stores.get('settings')!).language).toBe('de');
  });
  it('preferenze corrotte o rilevamento non disponibile ripiegano su inglese', async () => {
    mock.systemLocaleFailure = true;
    mock.stores.set('settings', '{broken');
    await runtime.initialize();
    expect(runtime.snapshot().settings.language).toBe('en');
    expect(JSON.parse(mock.stores.get('settings')!).language).toBe('en');
  });
  it('salva la lingua locale, usa il mazzo dell’host e conserva la lingua della partita alla ripresa', async () => {
    mock.stores.set('settings', JSON.stringify({ sound: true, haptic: false }));
    await runtime.initialize();
    expect(runtime.snapshot().settings.language).toBe('en');
    await runtime.settings({ ...runtime.snapshot().settings, language: 'es' });
    expect(JSON.parse(mock.stores.get('settings')!).language).toBe('es');
    await runtime.host('Dispositivo único', 'local', false, null, 'single');
    await runtime.act({ type: 'start' });
    const view = runtime.snapshot().view!;
    expect(view.language).toBe('es');
    const { wordLists } = await import('../src/content/words');
    expect(view.board.every((card) => wordLists.es.includes(card.word))).toBe(true);
    await runtime.leave();
    await runtime.settings({ ...runtime.snapshot().settings, language: 'fr' });
    await runtime.host('Ignorato', 'bluetooth', true);
    expect(runtime.snapshot().settings.language).toBe('fr');
    expect(runtime.snapshot().view!.language).toBe('es');
    expect(runtime.snapshot().view!.board.map((card) => card.word)).toEqual(
      view.board.map((card) => card.word),
    );
    expect(mock.nativeStarts).toBe(0);
    expect(mock.permissionRequests).toBe(0);
  });
  it('Single device gioca senza rete o permessi, cambia ruolo e squadra e chiude eventi di rete tardivi', async () => {
    await runtime.host('Telefono', 'bluetooth', false, null, 'single');
    expect(runtime.snapshot().mode).toBe('local');
    expect(runtime.snapshot().hostInfo).toBeNull();
    await emit({ type: 'connected', peer: 'vecchio-socket' });
    expect(mock.closed).toContain('vecchio-socket');
    expect(runtime.snapshot().pending).toHaveLength(0);
    await runtime.act({ type: 'start' });
    let v = runtime.snapshot().view!;
    expect(v.players).toHaveLength(1);
    expect(v.board.every((c) => !('color' in c))).toBe(true);
    await runtime.act({ type: 'handoff', turn: v.turn, phase: 'clue' });
    v = runtime.snapshot().view!;
    const index = v.board.findIndex((c) => c.color === 'neutral');
    expect(v.board.every((c) => 'color' in c)).toBe(true);
    await runtime.act({ type: 'clue', word: 'Ineffabile', count: 2 });
    expect(runtime.snapshot().view!.board.every((c) => !('color' in c))).toBe(true);
    await runtime.act({ type: 'handoff', turn: v.turn, phase: 'guess' });
    await runtime.act({ type: 'guess', index });
    expect(runtime.snapshot().view!.turn).toBe(v.turn + 1);
    expect(
      runtime
        .snapshot()
        .view!.board.filter((c) => !c.revealed)
        .every((c) => !('color' in c)),
    ).toBe(true);
    expect(mock.nativeStarts).toBe(0);
    expect(mock.permissionRequests).toBe(0);
    expect(mock.connectionCalls).toBe(0);
    expect(mock.sent).toHaveLength(0);
  });
  it('Single device in background e dopo riapertura conserva la partita ma maschera la mappa', async () => {
    await runtime.host('Telefono', 'lan', false, 30, 'single');
    await runtime.act({ type: 'start' });
    const turn = runtime.snapshot().view!.turn;
    await runtime.act({ type: 'handoff', turn, phase: 'clue' });
    mock.appState?.('background');
    await drain();
    expect(runtime.snapshot().view!.board.every((c) => !('color' in c))).toBe(true);
    mock.appState?.('active');
    await drain();
    expect(runtime.snapshot().view!.turn).toBe(turn);
    expect(runtime.snapshot().view!.board.every((c) => !('color' in c))).toBe(true);
    await runtime.act({ type: 'handoff', turn, phase: 'clue' });
    await runtime.leave();
    await runtime.host('Ignorato', 'bluetooth', true);
    expect(runtime.snapshot().mode).toBe('local');
    expect(runtime.snapshot().view!.playStyle).toBe('single');
    expect(runtime.snapshot().view!.board.every((c) => !('color' in c))).toBe(true);
    expect(mock.nativeStarts).toBe(0);
    expect(mock.permissionRequests).toBe(0);
    expect(mock.connectionCalls).toBe(0);
  });
  it('due sessioni condivise: passaggi, colori filtrati, cambio squadra e rientro nello stato attuale', async () => {
    await runtime.host('Suggeritori', 'lan', false, null, 'shared');
    await emit({ type: 'connected', peer: 'd' });
    await message('d', {
      type: 'hello',
      nickname: 'Decifratori',
      roomCode: runtime.snapshot().roomCode,
    });
    await runtime.approve('d', true);
    const credentials = last('d', 'welcome').credentials;
    const cmd = async (action: object, peer = 'd') =>
      message(peer, {
        type: 'command',
        id: (++mock.serial).toString(16).padStart(64, '0'),
        gameId: runtime.snapshot().view!.id,
        version: runtime.snapshot().view!.version,
        action,
      });
    await runtime.act({ type: 'ready', ready: true });
    await cmd({ type: 'ready', ready: true });
    await runtime.act({ type: 'start' });
    expect(runtime.snapshot().view!.players).toHaveLength(2);
    expect(runtime.snapshot().view!.board.every((c) => !('color' in c))).toBe(true);
    let turn = runtime.snapshot().view!.turn;
    await runtime.act({ type: 'handoff', turn });
    expect(runtime.snapshot().view!.board.every((c) => 'color' in c)).toBe(true);
    await runtime.act({ type: 'clue', word: 'Ineffabile', count: 2 });
    const index = runtime.snapshot().view!.board.findIndex((c) => c.color === 'neutral');
    await cmd({ type: 'guess', index });
    expect(last('d', 'ack').receipt.ok).toBe(false);
    expect(last('d', 'state').view.board.every((c: any) => !('color' in c))).toBe(true);
    await cmd({ type: 'handoff', turn });
    await cmd({ type: 'guess', index });
    const current = runtime.snapshot().view!;
    expect(current.turn).toBe(turn + 1);
    expect(current.board.filter((c) => !c.revealed).every((c) => !('color' in c))).toBe(true);
    await emit({ type: 'disconnected', peer: 'd' });
    await emit({ type: 'connected', peer: 'd-new' });
    await message('d-new', {
      type: 'hello',
      nickname: 'Decifratori',
      roomCode: '',
      resume: credentials,
    });
    const resumed = last('d-new', 'welcome');
    expect(resumed.view.turn).toBe(current.turn);
    expect(resumed.view.players).toHaveLength(2);
    expect(resumed.view.board.filter((c: any) => 'color' in c)).toHaveLength(1);
    expect(resumed.view.players.find((p: any) => p.id === credentials.playerId).handoffTurn).toBe(
      turn,
    );
  });
  it.each(['lan', 'bluetooth'] as const)(
    'rifiuta versioni diverse o assenti prima dell’approvazione su %s',
    async (mode) => {
      await runtime.host('Host', mode);
      for (const [peer, appVersion] of [
        ['vecchio', '0.3.1'],
        ['legacy', undefined],
        ['futuro', '99.0.0'],
      ] as const) {
        await emit({ type: 'connected', peer });
        await message(peer, {
          type: 'hello',
          nickname: 'Anna',
          roomCode: runtime.snapshot().roomCode,
          appVersion,
        });
        expect(last(peer, 'rejected')).toMatchObject({
          code: 'VERSION_MISMATCH',
          appVersion: APP_VERSION,
        });
        expect(mock.closed).toContain(peer);
      }
      expect(runtime.snapshot().pending).toHaveLength(0);
      expect(runtime.snapshot().view!.players).toHaveLength(1);
      await emit({ type: 'connected', peer: 'compatibile' });
      await message('compatibile', {
        type: 'hello',
        nickname: 'Anna',
        roomCode: runtime.snapshot().roomCode,
      });
      expect(runtime.snapshot().pending).toHaveLength(1);
    },
  );
  it('non riprende credenziali valide se la versione app è diversa', async () => {
    await runtime.host('Host', 'lan');
    await emit({ type: 'connected', peer: 'p' });
    await message('p', { type: 'hello', nickname: 'Anna', roomCode: runtime.snapshot().roomCode });
    await runtime.approve('p', true);
    const credentials = last('p', 'welcome').credentials;
    await emit({ type: 'disconnected', peer: 'p' });
    await emit({ type: 'connected', peer: 'rientro' });
    await message('rientro', {
      type: 'hello',
      nickname: 'Anna',
      roomCode: '',
      resume: credentials,
      appVersion: '0.3.1',
    });
    expect(last('rientro', 'rejected').code).toBe('VERSION_MISMATCH');
    expect(
      runtime.snapshot().view!.players.find((p) => p.id === credentials.playerId)?.connected,
    ).toBe(false);
  });
  it.each([undefined, '0.3.1', '99.0.0'])(
    'client blocca un host %s e non ritenta su timer o ritorno in app',
    async (appVersion) => {
      await runtime.join({
        mode: 'lan',
        address: '192.168.1.2',
        port: 42831,
        roomCode: 'ABCDEF',
        nickname: 'Anna',
      });
      expect(last('host', 'hello').appVersion).toBe(APP_VERSION);
      await message('host', { type: 'pending', appVersion });
      expect(runtime.snapshot().error).toContain('Versioni app incompatibili');
      expect(runtime.snapshot().error).toContain(APP_VERSION);
      expect(runtime.snapshot().busy).toBe(false);
      expect(runtime.snapshot().view).toBeNull();
      expect(mock.closed).toContain('host');
      mock.sent = [];
      await vi.advanceTimersByTimeAsync(30000);
      await runtime.resumeTransport();
      expect(mock.sent).toHaveLength(0);
      expect(mock.stores.has('client')).toBe(false);
      await runtime.join({
        mode: 'lan',
        address: '192.168.1.2',
        port: 42831,
        roomCode: 'ABCDEF',
        nickname: 'Anna',
      });
      expect(last('host', 'hello').appVersion).toBe(APP_VERSION);
    },
  );
  it('controlla anche la versione dentro il tunnel cifrato prima di creare una richiesta', async () => {
    await runtime.host('Host', 'bluetooth');
    await emit({ type: 'connected', peer: 'ponte' });
    await message('ponte', { type: 'hello', nickname: 'Ponte', roomCode: '' });
    await runtime.approve('ponte', true);
    const random = () => randomBytes(32).toString('hex');
    const route = random(),
      keys = tunnelKeys(random);
    await message('ponte', { type: 'relay-open', route });
    await message('ponte', {
      type: 'relay-frame',
      route,
      data: JSON.stringify(envelope({ type: 'tunnel-hello', publicKey: keys.publicKey })),
    });
    const key = JSON.parse(last('ponte', 'relay-frame').data).publicKey;
    const tunnel = new SecureTunnel(keys.secretKey, key, random);
    await message('ponte', {
      type: 'relay-frame',
      route,
      data: JSON.stringify(
        envelope(
          tunnel.seal(
            JSON.stringify({
              v: 1,
              appVersion: '0.3.1',
              type: 'hello',
              nickname: 'Vecchio',
              roomCode: '',
            }),
          ),
        ),
      ),
    });
    const rejected = mock.sent
      .filter((p) => p.message.type === 'relay-frame')
      .map((p) => JSON.parse(p.message.data))
      .filter((p) => p.type === 'tunnel-data');
    expect(JSON.parse(tunnel.open(rejected.at(-1))).code).toBe('VERSION_MISMATCH');
    expect(runtime.snapshot().pending).toHaveLength(0);
    expect(runtime.snapshot().view!.players).toHaveLength(2);
  });
  it('mostra candidati senza UUID, gestisce verifica tardiva, interruzione e nuova ricerca', async () => {
    await runtime.discover();
    await emit({ type: 'device', address: 'A', name: 'Telefono', paired: true });
    expect(runtime.snapshot().nearby[0]).toMatchObject({ address: 'A', verified: false });
    await emit({ type: 'discoveryStage', stage: 'services' });
    expect(runtime.snapshot()).toMatchObject({ scanning: true, discoveryStage: 'services' });
    await emit({ type: 'discoveryFinished' });
    expect(runtime.snapshot().scanning).toBe(false);
    await emit({ type: 'host', address: 'A', name: 'Telefono', relay: false });
    expect(runtime.snapshot().nearby).toHaveLength(1);
    expect(runtime.snapshot().nearby[0]?.verified).toBe(true);
    await runtime.discover();
    expect(runtime.snapshot()).toMatchObject({
      scanning: true,
      discoveryStage: 'scan',
      nearby: [],
    });
    await runtime.stopDiscovery();
    expect(runtime.snapshot().scanning).toBe(false);
  });
  it('riprende un client anche dopo ricreazione del processo, ma rispetta Lascia stanza e la scelta di ospitare', async () => {
    const endpoint = {
      mode: 'lan',
      address: '192.168.1.2',
      port: 42831,
      roomCode: 'ABCDEF',
      nickname: 'Anna',
    };
    const credentials = { gameId: 'a'.repeat(64), playerId: 'b'.repeat(64), token: 'c'.repeat(64) };
    mock.stores.set(
      'client',
      JSON.stringify({ schema: 1, endpoint, credentials, resumeOnLaunch: true }),
    );
    await runtime.initialize();
    expect(runtime.snapshot().active).toBe(true);
    expect(runtime.snapshot().view).toBeNull();
    expect(last('host', 'hello').resume).toEqual(credentials);
    await runtime.leave();
    expect(JSON.parse(mock.stores.get('client')!).resumeOnLaunch).toBe(false);
    mock.sent = [];
    const ColdRuntime = (await import('../src/session/runtime')).Runtime;
    const cold = new ColdRuntime();
    await cold.initialize();
    expect(cold.snapshot().active).toBe(false);
    expect(mock.sent).toHaveLength(0);
    mock.stores.set(
      'client',
      JSON.stringify({ schema: 1, endpoint, credentials, resumeOnLaunch: true }),
    );
    await cold.host('Host', 'lan');
    expect(JSON.parse(mock.stores.get('client')!).resumeOnLaunch).toBe(false);
  });
  it('client può bloccare o cambiare app: al rientro solo hello, comandi bloccati fino allo snapshot attuale', async () => {
    await runtime.host('Host', 'lan');
    await emit({ type: 'connected', peer: 'p' });
    await message('p', { type: 'hello', nickname: 'Anna', roomCode: runtime.snapshot().roomCode });
    await runtime.approve('p', true);
    const welcome = last('p', 'welcome');
    await runtime.leave();
    await runtime.join({
      mode: 'lan',
      address: '192.168.1.2',
      port: 42831,
      roomCode: 'ABCDEF',
      nickname: 'Anna',
    });
    await message('host', welcome);
    await runtime.act({ type: 'ready', ready: true });
    mock.appState?.('background');
    await drain();
    expect(runtime.snapshot().busy).toBe(false);
    mock.sent = [];
    mock.appState?.('active');
    await drain();
    expect(mock.sent.map((x) => x.message.type)).toEqual(['hello']);
    expect(last('host', 'hello').resume).toEqual(welcome.credentials);
    await expect(runtime.act({ type: 'ready', ready: true })).rejects.toThrow('Sincronizzazione');
    const current = {
      ...welcome.view,
      version: welcome.view.version + 9,
      history: ['Lo stato è avanzato mentre il client era assente'],
    };
    await message('host', { ...welcome, view: current, hostTime: Date.now() + 120000 });
    expect(runtime.snapshot().view!.version).toBe(current.version);
    expect(runtime.snapshot().hostTimeOffset).toBe(120000);
    expect(runtime.snapshot().status).toBe('Connesso all’host');
    expect(mock.sent.filter((x) => x.message.type === 'command')).toHaveLength(0);
  });
  it('telefono ponte inoltra il tunnel, arresta i listener al distacco e li riapre dopo il recupero', async () => {
    await runtime.host('Host', 'bluetooth');
    await emit({ type: 'connected', peer: 'p' });
    await message('p', { type: 'hello', nickname: 'Ponte', roomCode: '' });
    await runtime.approve('p', true);
    const welcome = last('p', 'welcome');
    await runtime.leave();
    await runtime.join({
      mode: 'bluetooth',
      address: 'AA:BB:CC:DD:EE:FF',
      port: 0,
      roomCode: '',
      nickname: 'Ponte',
    });
    await message('host', welcome);
    await runtime.setRelay(true);
    expect(mock.relayStarts).toBe(1);
    await emit({ type: 'connected', peer: 'child', client: false });
    const route = last('host', 'relay-open').route;
    await message('child', { type: 'tunnel-hello', publicKey: '1'.repeat(64) });
    expect(JSON.parse(last('host', 'relay-frame').data).type).toBe('tunnel-hello');
    await message('host', {
      type: 'relay-frame',
      route,
      data: JSON.stringify(envelope({ type: 'tunnel-key', publicKey: '2'.repeat(64) })),
    });
    expect(last('child', 'tunnel-key').publicKey).toBe('2'.repeat(64));
    await emit({ type: 'disconnected', peer: 'host' });
    expect(mock.relayStops).toBe(1);
    expect(mock.closed).toContain('child');
    expect(runtime.snapshot().relayEnabled).toBe(false);
    await runtime.resumeTransport();
    await message('host', welcome);
    expect(mock.relayStarts).toBe(2);
    expect(runtime.snapshot().relayEnabled).toBe(true);
  });
  it('client tramite ponte non invia hello prima della verifica e conserva solo la chiave pubblica', async () => {
    const random = () => randomBytes(32).toString('hex');
    const root = tunnelKeys(random);
    await runtime.join({
      mode: 'bluetooth',
      address: 'AA:BB:CC:DD:EE:FF',
      port: 0,
      roomCode: '',
      nickname: 'Anna',
      viaRelay: true,
    });
    const pub = last('host', 'tunnel-hello').publicKey;
    const tunnel = new SecureTunnel(root.secretKey, pub, random);
    await message('host', { type: 'tunnel-key', publicKey: root.publicKey });
    expect(runtime.snapshot().waitingFingerprint).not.toBe('');
    expect(
      mock.sent.some((x) => x.message.type === 'hello' || x.message.type === 'tunnel-data'),
    ).toBe(false);
    await runtime.confirmRelayHost();
    const hello = JSON.parse(tunnel.open(last('host', 'tunnel-data')));
    expect(hello.nickname).toBe('Anna');
    expect(hello.resume).toBeUndefined();
    await runtime.leave();
  });
  it('LAN ammette nove client oltre all’host e rifiuta l’undicesima persona', async () => {
    await runtime.host('Host', 'lan');
    for (let i = 1; i <= 10; i++) {
      await emit({ type: 'connected', peer: `lan${i}` });
      await message(`lan${i}`, {
        type: 'hello',
        nickname: `Persona${i}`,
        roomCode: runtime.snapshot().roomCode,
      });
      if (i < 10) await runtime.approve(`lan${i}`, true);
      else await expect(runtime.approve(`lan${i}`, true)).rejects.toThrow('piena');
    }
    expect(runtime.snapshot().view!.players).toHaveLength(10);
    expect(mock.closed).toContain('lan10');
  });
  it('dieci persone Bluetooth: sette dirette e due cifrate via ponte, filtro ruoli, limite e distacco', async () => {
    await runtime.host('Host', 'bluetooth');
    for (let i = 1; i <= 7; i++) {
      await emit({ type: 'connected', peer: `p${i}` });
      await message(`p${i}`, { type: 'hello', nickname: `Diretto${i}`, roomCode: '' });
      await runtime.approve(`p${i}`, true);
    }
    const random = () => randomBytes(32).toString('hex');
    const children = [] as {
      route: string;
      tunnel: SecureTunnel;
      credentials: any;
      cursor: number;
      decoded: any[];
    }[];
    const forwarded = async (route: string, inner: object) =>
      message('p1', { type: 'relay-frame', route, data: JSON.stringify(envelope(inner)) });
    const read = (c: (typeof children)[number]) => {
      const packets = mock.sent
        .slice(c.cursor)
        .filter(
          (x) => x.peer === 'p1' && x.message.type === 'relay-frame' && x.message.route === c.route,
        );
      c.cursor = mock.sent.length;
      for (const packet of packets) {
        const m = JSON.parse(packet.message.data);
        if (m.type === 'tunnel-data') c.decoded.push(JSON.parse(c.tunnel.open(m)));
      }
    };
    for (let i = 0; i < 2; i++) {
      const route = random(),
        keys = tunnelKeys(random);
      await message('p1', { type: 'relay-open', route });
      await forwarded(route, { type: 'tunnel-hello', publicKey: keys.publicKey });
      const key = JSON.parse(last('p1', 'relay-frame').data).publicKey;
      const c = {
        route,
        tunnel: new SecureTunnel(keys.secretKey, key, random),
        credentials: null as any,
        cursor: mock.sent.length,
        decoded: [] as any[],
      };
      children.push(c);
      await forwarded(
        route,
        c.tunnel.seal(
          JSON.stringify(envelope({ type: 'hello', nickname: `Ponte${i}`, roomCode: '' })),
        ),
      );
      const pending = runtime.snapshot().pending.find((p) => p.peer.endsWith(route))!;
      expect(pending).toBeDefined();
      await runtime.approve(pending.peer, true);
      read(c);
      c.credentials = c.decoded.find((m) => m.type === 'welcome').credentials;
    }
    expect(runtime.snapshot().view!.players).toHaveLength(10);
    const command = (action: object) => ({
      v: 1,
      appVersion: APP_VERSION,
      type: 'command',
      gameId: runtime.snapshot().view!.id,
      id: random(),
      version: runtime.snapshot().view!.version,
      action,
    });
    for (const [i, c] of children.entries()) {
      await forwarded(
        c.route,
        c.tunnel.seal(
          JSON.stringify(command({ type: 'choose', team: i === 0 ? 'red' : 'blue', role: 'spy' })),
        ),
      );
      await forwarded(
        c.route,
        c.tunnel.seal(JSON.stringify(command({ type: 'ready', ready: true }))),
      );
    }
    for (let i = 1; i <= 7; i++) await message(`p${i}`, command({ type: 'ready', ready: true }));
    await runtime.act({ type: 'ready', ready: true });
    await runtime.act({ type: 'start' });
    for (const c of children) {
      read(c);
      expect(c.decoded.at(-1).view.board.filter((card: any) => 'color' in card)).toHaveLength(25);
      expect(JSON.stringify(mock.sent.filter((x) => x.peer === 'p1'))).not.toContain(
        c.credentials.token,
      );
    }
    expect(last('p1', 'state').view.board.filter((card: any) => 'color' in card)).toHaveLength(0);
    // A virtual session can resume during a game on a new route and fresh ephemeral key.
    const child = children[0]!;
    await message('p1', { type: 'relay-close', route: child.route });
    expect(runtime.snapshot().view!.paused).toBe(false);
    child.route = random();
    const fresh = tunnelKeys(random);
    await message('p1', { type: 'relay-open', route: child.route });
    await forwarded(child.route, { type: 'tunnel-hello', publicKey: fresh.publicKey });
    child.tunnel = new SecureTunnel(
      fresh.secretKey,
      JSON.parse(last('p1', 'relay-frame').data).publicKey,
      random,
    );
    child.cursor = mock.sent.length;
    child.decoded = [];
    await forwarded(
      child.route,
      child.tunnel.seal(
        JSON.stringify({
          v: 1,
          appVersion: APP_VERSION,
          type: 'hello',
          nickname: 'Rientro',
          roomCode: '',
          resume: child.credentials,
        }),
      ),
    );
    read(child);
    expect(child.decoded.find((m) => m.type === 'welcome').credentials).toEqual(child.credentials);
    expect(runtime.snapshot().pending).toHaveLength(0);
    expect(runtime.snapshot().view!.players).toHaveLength(10);
    expect(runtime.snapshot().view!.paused).toBe(false);
    await emit({ type: 'disconnected', peer: 'p1' });
    expect(runtime.snapshot().view!.players.filter((p) => !p.connected)).toHaveLength(3);
    expect(runtime.snapshot().view!.paused).toBe(false);
  });
  it('host e tre sessioni: approvazione, eco bidirezionale, rientro e revoca', async () => {
    await runtime.host('Host', 'bluetooth');
    for (let i = 1; i <= 3; i++) {
      await emit({ type: 'connected', peer: `p${i}` });
      await message(`p${i}`, { type: 'hello', nickname: `Utente${i}`, roomCode: '' });
      expect(last(`p${i}`, 'pending')).toBeDefined();
      await runtime.approve(`p${i}`, true);
    }
    expect(runtime.snapshot().view!.players).toHaveLength(4);
    const credential = last('p1', 'welcome').credentials;
    const view = runtime.snapshot().view!;
    await message('p1', {
      type: 'command',
      gameId: view.id,
      id: 'f'.repeat(64),
      version: view.version,
      playerId: view.hostId,
      role: 'spy',
      action: { type: 'probe', text: 'ciao' },
    });
    expect(last('p1', 'echo').text).toBe('ciao');
    await emit({ type: 'disconnected', peer: 'p1' });
    expect(runtime.snapshot().view!.paused).toBe(false);
    await emit({ type: 'connected', peer: 'p1-new' });
    await message('p1-new', {
      type: 'hello',
      nickname: 'Nome ignorato',
      roomCode: '',
      resume: credential,
    });
    expect(runtime.snapshot().view!.paused).toBe(false);
    expect(last('p1-new', 'welcome').credentials).toEqual(credential);
    await runtime.act({ type: 'remove', playerId: credential.playerId });
    await drain();
    expect(mock.closed).toContain('p1-new');
  });
  it('nessuno può impersonare host o leggere uno snapshot prima dell’approvazione', async () => {
    await runtime.host('Host', 'lan');
    await emit({ type: 'connected', peer: 'attacker' });
    await message('attacker', {
      type: 'command',
      gameId: runtime.snapshot().view!.id,
      id: 'a'.repeat(64),
      version: 0,
      action: { type: 'sync' },
      playerId: runtime.snapshot().ownId,
    });
    expect(mock.sent.some((x) => x.peer === 'attacker' && x.message.type === 'state')).toBe(false);
    expect(mock.closed).toContain('attacker');
    await emit({ type: 'connected', peer: 'bad-code' });
    await message('bad-code', { type: 'hello', nickname: 'Persona', roomCode: 'FFFFFF' });
    expect(runtime.snapshot().pending).toHaveLength(0);
    expect(mock.closed).toContain('bad-code');
  });
  it('pausa background: salvataggio presente e tutti i client offline', async () => {
    await runtime.host('Host', 'bluetooth');
    await emit({ type: 'connected', peer: 'p' });
    await message('p', { type: 'hello', nickname: 'Anna', roomCode: '' });
    await runtime.approve('p', true);
    mock.appState?.('background');
    await drain();
    expect(runtime.snapshot().view!.players.filter((p) => p.connected)).toHaveLength(1);
    expect(
      JSON.parse(mock.stores.get('host')!).game.players.filter((p: any) => p.connected),
    ).toHaveLength(1);
    mock.appState?.('active');
    await drain();
    expect(runtime.snapshot().status).toContain('Host disponibile');
  });
  it('client conserva solo credenziali e indirizzo, abbandona il comando pendente al distacco', async () => {
    // First get a realistic approved view/credential from a host.
    await runtime.host('Host', 'lan');
    await emit({ type: 'connected', peer: 'p' });
    await message('p', { type: 'hello', nickname: 'Anna', roomCode: runtime.snapshot().roomCode });
    await runtime.approve('p', true);
    const welcome = last('p', 'welcome');
    await runtime.leave();
    mock.sent = [];
    await runtime.join({
      mode: 'lan',
      address: '192.168.1.2',
      port: 42831,
      roomCode: 'ABCDEF',
      nickname: 'Anna',
    });
    await message('host', welcome);
    const saved = JSON.parse(mock.stores.get('client')!);
    expect(Object.keys(saved).sort()).toEqual([
      'credentials',
      'endpoint',
      'hostPublicKey',
      'resumeOnLaunch',
      'schema',
    ]);
    await runtime.act({ type: 'ready', ready: true });
    expect(runtime.snapshot().busy).toBe(true);
    await emit({ type: 'disconnected', peer: 'host' });
    expect(runtime.snapshot().busy).toBe(false);
    mock.sent = [];
    await runtime.resumeTransport();
    await drain();
    expect(mock.sent.map((x) => x.message.type)).toEqual(['hello']);
    expect(last('host', 'hello').resume).toEqual(welcome.credentials);
  });
  it('partita con quattro sessioni: colori esclusi dai messaggi a host e client indovinatori', async () => {
    await runtime.host('Host', 'bluetooth');
    const ids: string[] = [];
    for (let i = 1; i <= 3; i++) {
      await emit({ type: 'connected', peer: `p${i}` });
      await message(`p${i}`, { type: 'hello', nickname: `Utente${i}`, roomCode: '' });
      await runtime.approve(`p${i}`, true);
      ids.push(last(`p${i}`, 'welcome').credentials.playerId);
    }
    const sendCommand = async (peer: string, action: object) =>
      message(peer, {
        type: 'command',
        id: (++mock.serial).toString(16).padStart(64, '0'),
        gameId: runtime.snapshot().view!.id,
        version: runtime.snapshot().view!.version,
        action,
      });
    await sendCommand('p1', { type: 'choose', team: 'red', role: 'spy' });
    await sendCommand('p2', { type: 'choose', team: 'blue', role: 'spy' });
    for (let i = 1; i <= 3; i++) await sendCommand(`p${i}`, { type: 'ready', ready: true });
    await runtime.act({ type: 'ready', ready: true });
    await runtime.act({ type: 'start' });
    const cardsWithColor = (view: any) =>
      view.board.filter((c: any) => Object.hasOwn(c, 'color')).length;
    expect(cardsWithColor(runtime.snapshot().view)).toBe(0);
    expect(cardsWithColor(last('p1', 'state').view)).toBe(25);
    expect(cardsWithColor(last('p2', 'state').view)).toBe(25);
    expect(cardsWithColor(last('p3', 'state').view)).toBe(0);
    const spyPeer = runtime.snapshot().view!.active === 'red' ? 'p1' : 'p2';
    await sendCommand(spyPeer, { type: 'clue', word: 'Ineffabile', count: 2 });
    expect(runtime.snapshot().view!.phase).toBe('guess');
    const spyView = last(spyPeer, 'state').view;
    const neutral = spyView.board.findIndex((c: any) => c.color === 'neutral');
    const before = runtime.snapshot().view!.active;
    if (before === 'red') await runtime.act({ type: 'guess', index: neutral });
    else await sendCommand('p3', { type: 'guess', index: neutral });
    expect(runtime.snapshot().view!.active).not.toBe(before);
    expect(cardsWithColor(last('p3', 'state').view)).toBe(1);
    expect(Object.keys(last('p3', 'state'))).toEqual([
      'type',
      'view',
      'hostTime',
      'v',
      'appVersion',
    ]);
  });
});
