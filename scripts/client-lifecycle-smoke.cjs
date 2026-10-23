/* Development-only local host for testing a real Android client's background/resume.
 * Uses the project's authority, three test participants and loopback TCP only.
 * Emulator client joins 10.0.2.2:42831 using the printed room code.
 * Commands: advance (play a public clue + neutral choice while Android is away), quit.
 */
const net = require('node:net');
const crypto = require('node:crypto');
const readline = require('node:readline');
const ts = require('typescript');
const fs = require('node:fs');
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
const { Authority } = require('../src/session/authority.ts');
const { parse, hello, command, envelope } = require('../src/protocol/messages.ts');
const token = () => crypto.randomBytes(32).toString('hex');
const random = (n) => crypto.randomInt(n);
const port = Number(process.argv[2] || 42831);
(async () => {
  const a = Authority.create('Host collaudo', 'lan', token, random, { save: async () => {} });
  const bots = [];
  for (const name of ['Rosso test', 'Suggeritore blu', 'Blu test']) bots.push(await a.join(name));
  const act = async (playerId, action) => {
    const receipt = await a.execute(playerId, {
      v: 1,
      type: 'command',
      id: token(),
      gameId: a.data.game.id,
      version: a.data.game.version,
      action,
    });
    if (!receipt.ok) throw new Error(receipt.error);
  };
  await act(a.data.game.hostId, { type: 'choose', team: 'red', role: 'spy' });
  await act(bots[0].playerId, { type: 'choose', team: 'red', role: 'guesser' });
  await act(bots[1].playerId, { type: 'choose', team: 'blue', role: 'spy' });
  await act(bots[2].playerId, { type: 'choose', team: 'blue', role: 'guesser' });
  for (const p of a.data.game.players) await act(p.id, { type: 'ready', ready: true });
  const peers = new Map();
  let pending = Promise.resolve();
  let started = false;
  const schedule = (fn) => {
    pending = pending.then(fn).catch((e) => console.log(`VERIFICA: ${e.message}`));
  };
  function send(peer, message) {
    const bytes = Buffer.from(JSON.stringify(envelope({ ...message, hostTime: Date.now() })));
    if (bytes.length > 32768) throw new Error('Frame eccessivo');
    const head = Buffer.alloc(4);
    head.writeUInt32BE(bytes.length);
    peer.socket.write(Buffer.concat([head, bytes]));
  }
  const broadcast = () => {
    for (const p of peers.values())
      if (p.playerId) send(p, { type: 'state', view: a.view(p.playerId) });
  };
  const server = net.createServer((socket) => {
    const peer = { socket, bytes: Buffer.alloc(0) };
    peers.set(socket, peer);
    socket.on('data', (chunk) => {
      peer.bytes = Buffer.concat([peer.bytes, chunk]);
      while (peer.bytes.length >= 4) {
        const size = peer.bytes.readUInt32BE(0);
        if (!size || size > 32768) {
          socket.destroy();
          return;
        }
        if (peer.bytes.length < size + 4) break;
        const text = peer.bytes.subarray(4, size + 4).toString('utf8');
        peer.bytes = peer.bytes.subarray(size + 4);
        schedule(async () => {
          const m = parse(text);
          if (m.type === 'pong') return;
          if (m.type === 'ping') {
            send(peer, { type: 'pong' });
            return;
          }
          if (m.type === 'hello') {
            const request = hello(m);
            let credentials = request.resume;
            if (credentials) {
              a.authenticate(credentials);
              await a.presence(credentials.playerId, true);
            } else {
              if (request.roomCode !== a.data.roomCode || started)
                throw new Error('Ingresso non previsto');
              credentials = await a.join(request.nickname);
            }
            peer.playerId = credentials.playerId;
            send(peer, { type: 'welcome', credentials, view: a.view(peer.playerId) });
            console.log(
              `HELLO Android: resume=${!!request.resume}, versione=${a.data.game.version}, carte scoperte=${a.data.game.board.filter((c) => c.revealed).length}`,
            );
            if (!started) {
              await act(peer.playerId, { type: 'ready', ready: true });
              await act(a.data.game.hostId, { type: 'start' });
              started = true;
            }
            broadcast();
            return;
          }
          if (!peer.playerId) throw new Error('Sessione non approvata');
          const c = command(m);
          const receipt = await a.execute(peer.playerId, c);
          console.log(`COMANDO Android: ${c.action.type}, accettato=${receipt.ok}`);
          send(peer, { type: 'ack', receipt });
          broadcast();
        });
      }
    });
    socket.on('close', () =>
      schedule(async () => {
        peers.delete(socket);
        if (peer.playerId && ![...peers.values()].some((p) => p.playerId === peer.playerId)) {
          await a.presence(peer.playerId, false);
          broadcast();
          console.log(`Android scollegato; host continua, versione ${a.data.game.version}`);
        }
      }),
    );
    socket.on('error', () => {});
  });
  server.listen(port, '127.0.0.1', () =>
    console.log(
      `HOST DI COLLAUDO 10.0.2.2:${port}, CODICE ${a.data.roomCode}. Comandi: advance, quit. Nessuna prova radio.`,
    ),
  );
  const heartbeat = setInterval(() => {
    for (const p of peers.values()) send(p, { type: 'ping' });
  }, 2000);
  readline.createInterface({ input: process.stdin }).on('line', (line) =>
    schedule(async () => {
      if (line === 'quit') {
        clearInterval(heartbeat);
        for (const p of peers.values()) p.socket.destroy();
        server.close();
        process.exit(0);
      }
      if (line === 'advance') {
        if (!started) throw new Error('Collegare prima Android');
        const active = a.data.game.active;
        const spy = a.data.game.players.find((p) => p.team === active && p.role === 'spy');
        const guesser = a.data.game.players.find(
          (p) =>
            p.team === active &&
            p.role === 'guesser' &&
            p.id !== [...peers.values()][0]?.playerId &&
            bots.some((b) => b.playerId === p.id),
        );
        if (a.data.game.phase === 'clue')
          await act(spy.id, { type: 'clue', word: 'Ineffabile', count: 2 });
        await act(guesser.id, {
          type: 'guess',
          index: a.data.game.board.findIndex((c) => c.color === 'neutral' && !c.revealed),
        });
        broadcast();
        console.log(
          `STATO AVANZATO: versione ${a.data.game.version}, carte scoperte ${a.data.game.board.filter((c) => c.revealed).length}, client assente=${![...peers.values()].some((p) => p.playerId)}`,
        );
      }
    }),
  );
})();
