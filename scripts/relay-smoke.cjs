/* Development only: Android host + 7 TCP test peers + 2 encrypted virtual peers.
 * Tests the real APK router/crypto, NOT Bluetooth radio. Approve all nine in the APK.
 * The test trusts the host public key learned on the local direct test connection.
 * Run: node scripts/relay-smoke.cjs 127.0.0.1 42832 ABCDEF
 */
const net = require('node:net');
const crypto = require('node:crypto');
const readline = require('node:readline');
const ts = require('typescript');
const fs = require('node:fs');
const { version: appVersion } = require('../package.json');
require.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename,
  );
const { SecureTunnel, tunnelKeys, fingerprint } = require('../src/protocol/secure-tunnel.ts');
const [address, port, code] = process.argv.slice(2);
if (!address || !port || !/^[A-F\d]{6}$/i.test(code || ''))
  throw new Error('Uso: node scripts/relay-smoke.cjs IPv4 porta codice');
const random = () => crypto.randomBytes(32).toString('hex');
const clients = [],
  children = [],
  receipts = new Map();
let opened = false;
function send(c, m) {
  const text = JSON.stringify({ ...m, v: 1, appVersion });
  if (c.route)
    return send(clients[0], {
      type: 'relay-frame',
      route: c.route,
      data: JSON.stringify({ ...c.tunnel.seal(text), appVersion }),
    });
  const bytes = Buffer.from(text),
    header = Buffer.alloc(4);
  header.writeUInt32BE(bytes.length);
  c.socket.write(Buffer.concat([header, bytes]));
}
function receive(c, m) {
  if (m.type === 'relay-frame') {
    const child = children.find((x) => x.route === m.route);
    if (!child) throw new Error('Percorso sconosciuto');
    const inner = JSON.parse(m.data);
    if (inner.type === 'tunnel-key') {
      if (inner.publicKey !== c.hostKey) throw new Error('Chiave host sostituita');
      child.tunnel = new SecureTunnel(child.keys.secretKey, inner.publicKey, random);
      send(child, {
        type: 'hello',
        nickname: child.name,
        roomCode: code.toUpperCase(),
        ...(child.credentials ? { resume: child.credentials } : {}),
      });
    } else {
      const plain = child.tunnel.open(inner),
        decoded = JSON.parse(plain);
      if (decoded.type === 'welcome' && m.data.includes(decoded.credentials.token))
        throw new Error('Credenziale in chiaro sul ponte');
      receive(child, decoded);
    }
    return;
  }
  if (m.type === 'ping') return send(c, { type: 'pong' });
  if (m.type === 'welcome') {
    c.credentials = m.credentials;
    c.view = m.view;
    c.hostKey = m.hostPublicKey;
    console.log(`${c.name}: APPROVATO${c.route ? ' VIA TUNNEL CIFRATO' : ''}`);
    if (!opened && clients.every((x) => x.credentials)) {
      opened = true;
      console.log(`Impronta host del collaudo: ${fingerprint(clients[0].hostKey)}`);
      for (let i = 1; i <= 2; i++) {
        const child = { name: `Ponte${i}`, route: random(), keys: tunnelKeys(random) };
        children.push(child);
        send(clients[0], { type: 'relay-open', route: child.route });
        send(clients[0], {
          type: 'relay-frame',
          route: child.route,
          data: JSON.stringify({ v: 1, appVersion, type: 'tunnel-hello', publicKey: child.keys.publicKey }),
        });
      }
    }
  } else if (m.type === 'state') {
    c.view = m.view;
    const own = m.view.players.find((p) => p.id === c.credentials.playerId);
    const visible = m.view.board.filter((card) => 'color' in card).length;
    const expected =
      own.role === 'spy'
        ? m.view.board.length
        : m.view.board.filter((card) => card.revealed).length;
    if (visible !== expected) throw new Error('Filtro colori non rispettato');
    console.log(
      `${c.name}: ${m.view.players.filter((p) => p.connected).length} presenti · ${m.view.phase} · colori ${visible}, filtro OK${c.route ? ', tunnel autenticato' : ''}`,
    );
  } else if (m.type === 'ack') receipts.get(m.receipt.id)?.(m.receipt);
  else if (m.type === 'echo') console.log(`${c.name}: ECO verificato${c.route ? ' cifrato' : ''}`);
  else if (m.type === 'pending') console.log(`${c.name}: approvare nell’APK`);
  else if (m.type === 'rejected') console.log(`${c.name}: rifiutato: ${m.error}`);
}
for (let i = 1; i <= 7; i++) {
  const c = { name: `Diretto${i}`, buffer: Buffer.alloc(0) };
  clients.push(c);
  c.socket = net.connect(Number(port), address, () =>
    send(c, { type: 'hello', nickname: c.name, roomCode: code.toUpperCase() }),
  );
  c.socket.on('data', (chunk) => {
    c.buffer = Buffer.concat([c.buffer, chunk]);
    while (c.buffer.length >= 4) {
      const size = c.buffer.readUInt32BE(0);
      if (size < 1 || size > 32768) throw new Error('Framing non valido');
      if (c.buffer.length < size + 4) break;
      const message = JSON.parse(c.buffer.subarray(4, size + 4));
      c.buffer = c.buffer.subarray(size + 4);
      receive(c, message);
    }
  });
  c.socket.on('error', (error) => console.log(`${c.name}: ${error.message}`));
}
async function act(c, action) {
  if (!c.credentials) throw new Error('Approvare prima tutti i partecipanti');
  const id = random();
  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      receipts.delete(id);
      reject(new Error('ACK scaduto'));
    }, 8000);
    receipts.set(id, (receipt) => {
      clearTimeout(timer);
      receipts.delete(id);
      resolve(receipt);
    });
    send(c, { type: 'command', id, gameId: c.view.id, version: c.view.version, action });
  });
  if (!result.ok) throw new Error(result.error);
  await new Promise((resolve) => setTimeout(resolve, 120));
}
let operations = Promise.resolve();
console.log(
  'Comandi: configure (suggeritori via ponte), echo, clue, reconnect N, drop-gateway, quit. Solo collaudo locale, nessuna prova radio.',
);
readline.createInterface({ input: process.stdin }).on('line', (line) => {
  operations = operations
    .then(async () => {
      if (line === 'quit') {
        clients.forEach((c) => c.socket.destroy());
        process.exit(0);
      }
      if (line === 'configure') {
        for (const [i, c] of [...clients, ...children].entries()) {
          await act(c, {
            type: 'choose',
            team: i === 7 ? 'red' : 'blue',
            role: i >= 7 ? 'spy' : 'guesser',
          });
          await act(c, { type: 'ready', ready: true });
        }
        console.log(
          'Composizione pronta: suggeritori cifrati, host indovinatore rosso. Confermare pronto e avviare nell’APK.',
        );
      }
      if (line === 'echo')
        for (const c of [...clients, ...children])
          await act(c, { type: 'probe', text: `ECO ${c.name}` });
      if (line === 'clue') {
        const red = children[0].view.active === 'red';
        await act(children[red ? 0 : 1], { type: 'clue', word: 'Ineffabile', count: 2 });
      }
      if (line.startsWith('reconnect ')) {
        const c = children[Number(line.split(' ')[1]) - 1];
        if (!c) throw new Error('Figlio non valido');
        send(clients[0], { type: 'relay-close', route: c.route });
        await new Promise((resolve) => setTimeout(resolve, 500));
        c.route = random();
        c.keys = tunnelKeys(random);
        c.tunnel = undefined;
        send(clients[0], { type: 'relay-open', route: c.route });
        send(clients[0], {
          type: 'relay-frame',
          route: c.route,
          data: JSON.stringify({ v: 1, appVersion, type: 'tunnel-hello', publicKey: c.keys.publicKey }),
        });
      }
      if (line === 'drop-gateway') clients[0].socket.destroy();
    })
    .catch((error) => console.log(`VERIFICA: ${error.message}`));
});
