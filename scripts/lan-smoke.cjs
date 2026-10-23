/* DEVELOPMENT TEST CLIENTS ONLY. Not imported by the app and never needed to play.
 * Run against an open LAN host; the host must approve all three requests in its UI.
 * Example: node scripts/lan-smoke.cjs 127.0.0.1 42832 ABCDEF
 * On Android Emulator: adb forward tcp:42832 tcp:42831.
 */
const net = require('node:net');
const crypto = require('node:crypto');
const readline = require('node:readline');
const { version: appVersion } = require('../package.json');
const [address, port, code, count = '3'] = process.argv.slice(2);
if (!address || !port || !/^[A-F\d]{6}$/i.test(code || '') || !/^[1-9]$/.test(count)) {
  console.error('Uso: node scripts/lan-smoke.cjs IPv4 porta codice-stanza [client: 1–9]');
  process.exit(1);
}
const clients = [];
const receipts = new Map();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function send(client, message) {
  const payload = Buffer.from(JSON.stringify({ ...message, v: 1, appVersion }));
  if (payload.length > 32768) throw new Error('Frame eccessivo');
  const header = Buffer.alloc(4);
  header.writeUInt32BE(payload.length);
  client.socket.write(Buffer.concat([header, payload]));
}
function connect(client, resume = false) {
  client.buffer = Buffer.alloc(0);
  client.socket = net.connect(Number(port), address, () => {
    console.log(`${client.name}: socket TCP connesso`);
    send(client, {
      type: 'hello',
      nickname: client.name,
      roomCode: code.toUpperCase(),
      ...(resume ? { resume: client.credentials } : {}),
    });
  });
  client.socket.on('data', (chunk) => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    while (client.buffer.length >= 4) {
      const size = client.buffer.readUInt32BE(0);
      if (!size || size > 32768) throw new Error('Frame host non valido');
      if (client.buffer.length < size + 4) break;
      const m = JSON.parse(client.buffer.subarray(4, size + 4));
      client.buffer = client.buffer.subarray(size + 4);
      if (m.type === 'ping') send(client, { type: 'pong' });
      else if (m.type === 'welcome') {
        client.credentials = m.credentials;
        client.view = m.view;
        console.log(`${client.name}: APPROVATO, v${m.view.version}`);
      } else if (m.type === 'state') {
        client.view = m.view;
        const own = m.view.players.find((p) => p.id === client.credentials.playerId);
        const disclosed = m.view.board.filter((c) => Object.hasOwn(c, 'color')).length;
        const handoff =
          m.view.playStyle === 'shared' &&
          ['clue', 'guess'].includes(m.view.phase) &&
          own.handoffTurn !== m.view.turn;
        const permitted =
          own.role === 'spy' && !handoff
            ? m.view.board.length
            : m.view.board.filter((c) => c.revealed).length;
        if (disclosed !== permitted) throw new Error('ERRORE DI RISERVATEZZA');
        console.log(
          `${client.name}: v${m.view.version}, ${m.view.phase}, ${m.view.players.filter((p) => p.connected).length} presenti, filtro colori OK`,
        );
      } else if (m.type === 'ack') receipts.get(m.receipt.id)?.(m.receipt);
      else if (m.type === 'echo') console.log(`${client.name}: ECO verificato`);
      else if (m.type === 'pending')
        console.log(`${client.name}: attendi approvazione nell’app host`);
      else if (m.type === 'rejected') console.log(`${client.name}: rifiutato (${m.error})`);
    }
  });
  client.socket.on('error', (e) => console.log(`${client.name}: ${e.message}`));
  client.socket.on('close', () => console.log(`${client.name}: scollegato`));
}
for (let i = 1; i <= Number(count); i++) {
  const client = { name: `Collaudo${i}`, view: null, credentials: null };
  clients.push(client);
  connect(client);
}
async function act(client, action) {
  if (!client.view || !client.credentials) throw new Error('Approva prima tutti i client');
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = crypto.randomBytes(32).toString('hex');
    const receipt = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        receipts.delete(id);
        reject(new Error('ACK scaduto'));
      }, 8000);
      receipts.set(id, (r) => {
        clearTimeout(timer);
        receipts.delete(id);
        resolve(r);
      });
      send(client, {
        type: 'command',
        id,
        gameId: client.view.id,
        version: client.view.version,
        action,
      });
    });
    await delay(150);
    if (receipt.ok) return;
    if (!receipt.error.includes('Stato aggiornato')) throw new Error(receipt.error);
  }
  throw new Error('Concorrenza persistente');
}
console.log(
  'Comandi: configure, role spy/guesser (condivisa), handoff, guess N (1–25), echo, clue, assassin, reconnect N, quit. Nessuna credenziale o mappa viene stampata.',
);
const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
let commandTail = Promise.resolve();
terminal.on('line', (line) => {
  commandTail = commandTail
    .then(async () => {
      if (line === 'quit') {
        clients.forEach((c) => c.socket.destroy());
        terminal.close();
        return;
      }
      if (line === 'echo')
        for (const c of clients) await act(c, { type: 'probe', text: `ECO ${c.name}` });
      if (line === 'configure') {
        if (clients[0].view?.playStyle === 'shared') {
          for (const c of clients) await act(c, { type: 'ready', ready: true });
          return;
        }
        // Host stays red guesser; two spymasters and a blue guesser on these real TCP sessions.
        for (const [i, c] of clients.entries()) {
          await act(c, {
            type: 'choose',
            team: i === 0 ? 'red' : 'blue',
            role: i < 2 ? 'spy' : 'guesser',
          });
          await act(c, { type: 'ready', ready: true });
        }
      }
      if (line === 'clue') {
        if (clients[0].view.playStyle === 'shared') {
          const c = clients.find(
            (c) => c.view.players.find((p) => p.id === c.credentials.playerId).role === 'spy',
          );
          if (!c) throw new Error('Invia l’indizio dalla UI del dispositivo suggeritori');
          await act(c, { type: 'clue', word: 'Ineffabile', count: 2 });
          return;
        }
        const team = clients[0].view.active;
        await act(clients[team === 'red' ? 0 : 1], { type: 'clue', word: 'Ineffabile', count: 2 });
      }
      if (line === 'handoff')
        for (const c of clients) await act(c, { type: 'handoff', turn: c.view.turn });
      if (/^role (spy|guesser)$/.test(line)) {
        await act(clients[0], { type: 'choose', role: line.split(' ')[1], team: 'red' });
        await act(clients[0], { type: 'ready', ready: true });
      }
      if (/^guess \d+$/.test(line)) {
        const index = Number(line.split(' ')[1]) - 1;
        if (index < 0 || index >= 25) throw new Error('Carta: 1–25');
        await act(clients[0], { type: 'guess', index });
      }
      if (line === 'assassin') {
        if (clients[0].view.active !== 'blue')
          throw new Error('Il turno rosso richiede una scelta dall’UI dell’host');
        const index = clients[1].view.board.findIndex((c) => c.color === 'assassin');
        await act(clients[2], { type: 'guess', index });
      }
      if (line.startsWith('reconnect ')) {
        const c = clients[Number(line.split(' ')[1]) - 1];
        if (!c?.credentials) throw new Error('Client non valido');
        c.socket.destroy();
        await delay(600);
        connect(c, true);
      }
    })
    .catch((e) => console.error(`TEST: ${e.message}`));
});
