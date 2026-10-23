import { wordLists } from '../content/words';
import { isLanguage, type Language } from '../content/languages';
import {
  Action,
  Card,
  Color,
  Game,
  MAX_PLAYERS,
  MAX_HISTORY,
  Player,
  PlayStyle,
  RandomInt,
  Team,
  TURN_SECONDS,
  View,
  ensure,
  normalize,
  other,
  needsHandoff,
  effectiveRole,
} from './model';

export function shuffle<T>(input: readonly T[], random: RandomInt): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = random(i + 1);
    ensure(Number.isInteger(j) && j >= 0 && j <= i, 'Casualità non valida');
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
export function newGame(
  id: string,
  host: Player,
  turnSeconds: number | null = null,
  playStyle: PlayStyle = 'classic',
  language: Language = 'it',
): Game {
  ensure(isLanguage(language), 'Lingua non valida');
  ensure(
    playStyle === 'classic' || playStyle === 'shared' || playStyle === 'single',
    'Modalità partita non valida',
  );
  ensure(
    turnSeconds === null || TURN_SECONDS.some((n) => n === turnSeconds),
    'Durata turno non valida',
  );
  return {
    schema: 1,
    playStyle,
    language,
    turn: 0,
    id,
    hostId: host.id,
    version: 0,
    players: [host],
    phase: 'lobby',
    board: [],
    active: 'red',
    clue: null,
    guesses: 0,
    remaining: null,
    winner: null,
    reason: null,
    history: [],
    round: 0,
    turnSeconds,
    turnEndsAt: null,
  };
}
export function board(
  random: RandomInt,
  language: Language = 'it',
): { cards: Card[]; first: Team } {
  const first: Team = random(2) === 0 ? 'red' : 'blue';
  const colors: Color[] = [
    ...Array<Color>(9).fill(first),
    ...Array<Color>(8).fill(other(first)),
    ...Array<Color>(7).fill('neutral'),
    'assassin',
  ];
  const keys = shuffle(colors, random);
  return {
    first,
    cards: shuffle(wordLists[language], random)
      .slice(0, 25)
      .map((word, i) => ({ word, color: keys[i]!, revealed: false })),
  };
}
export function validLobby(g: Pick<Game, 'players' | 'playStyle'>): boolean {
  if (g.playStyle === 'single')
    return g.players.length === 1 && g.players[0]!.ready && g.players[0]!.connected;
  if (g.playStyle === 'shared')
    return (
      g.players.length >= 2 &&
      g.players.length <= MAX_PLAYERS &&
      g.players.every((p) => p.ready && p.connected) &&
      g.players.filter((p) => p.role === 'spy').length === 1 &&
      g.players.some((p) => p.role === 'guesser')
    );
  return (
    g.players.length >= 4 &&
    g.players.length <= MAX_PLAYERS &&
    g.players.every((p) => p.ready && p.connected) &&
    (['red', 'blue'] as Team[]).every(
      (t) =>
        g.players.filter((p) => p.team === t && p.role === 'spy').length === 1 &&
        g.players.some((p) => p.team === t && p.role === 'guesser'),
    )
  );
}
function next(g: Game, now: number) {
  g.turn++;
  g.active = other(g.active);
  g.phase = 'clue';
  g.guesses = 0;
  g.remaining = null;
  g.clue = null;
  g.turnEndsAt = g.turnSeconds ? now + g.turnSeconds * 1000 : null;
  g.history.push(`Turno squadra ${g.active === 'red' ? 'rossa' : 'blu'}.`);
}
function win(g: Game, team: Team, reason: string) {
  g.phase = 'finished';
  g.winner = team;
  g.reason = reason;
  g.turnEndsAt = null;
  g.history.push(reason);
}
export function counters(g: Game): Record<Team, number> {
  return {
    red: g.board.filter((c) => c.color === 'red' && !c.revealed).length,
    blue: g.board.filter((c) => c.color === 'blue' && !c.revealed).length,
  };
}
export function project(g: Game, playerId: string): View {
  const p = g.players.find((x) => x.id === playerId);
  ensure(p, 'Sessione non valida');
  // Explicit whitelist: never spread an authoritative state into a network snapshot.
  return {
    id: g.id,
    playStyle: g.playStyle,
    language: g.language ?? 'it',
    turn: g.turn,
    hostId: g.hostId,
    version: g.version,
    players: g.players.map((x) => ({ ...x })),
    phase: g.phase,
    board: g.board.map((c) =>
      (effectiveRole(g, p) === 'spy' && !needsHandoff(g, p)) || c.revealed
        ? {
            word: c.word,
            revealed: c.revealed,
            color: c.color,
            ...(c.revealed && c.selectedBy ? { selectedBy: c.selectedBy } : {}),
          }
        : { word: c.word, revealed: c.revealed },
    ),
    active: g.active,
    clue: g.clue ? { ...g.clue } : null,
    guesses: g.guesses,
    remaining: g.remaining,
    winner: g.winner,
    reason: g.reason,
    history: [...g.history],
    round: g.round,
    turnSeconds: g.turnSeconds,
    turnEndsAt: g.turnEndsAt,
    paused: !g.players.find((x) => x.id === g.hostId)?.connected,
    counters: counters(g),
  };
}
/** Only the host's local authority calls this, using its own clock. One expiry per observed turn. */
export function expireTurn(game: Game, now: number): Game | null {
  if (
    !game.turnSeconds ||
    game.turnEndsAt == null ||
    now < game.turnEndsAt ||
    (game.phase !== 'clue' && game.phase !== 'guess')
  )
    return null;
  const g: Game = JSON.parse(JSON.stringify(game));
  g.history.push(`Tempo scaduto per la squadra ${g.active === 'red' ? 'rossa' : 'blu'}.`);
  next(g, now);
  g.history = g.history.slice(-MAX_HISTORY);
  g.version++;
  return g;
}
export function apply(
  game: Game,
  actorId: string,
  action: Action,
  random: RandomInt,
  now = Date.now(),
): Game {
  const g: Game = JSON.parse(JSON.stringify(game));
  const actor = g.players.find((p) => p.id === actorId);
  ensure(actor, 'Partecipante non presente');
  ensure(actor.connected, 'Sessione scollegata');
  const host = () => ensure(actor.id === g.hostId, 'Solo l’host può farlo');
  const lobby = () =>
    ensure(g.phase === 'lobby', 'Squadre e ruoli sono bloccati durante la partita');
  const active = (role: 'spy' | 'guesser', phase: 'clue' | 'guess') => {
    ensure(g.players.find((p) => p.id === g.hostId)?.connected, 'Host non disponibile');
    ensure(g.turnEndsAt == null || now < g.turnEndsAt, 'Tempo del turno scaduto');
    ensure(
      g.phase === phase &&
        (g.playStyle !== 'classic' || actor.team === g.active) &&
        effectiveRole(g, actor) === role,
      'Azione non consentita nel tuo ruolo o turno',
    );
    ensure(!needsHandoff(g, actor), 'Conferma il passaggio del dispositivo alla squadra di turno');
  };
  switch (action.type) {
    case 'choose':
      lobby();
      ensure(
        g.playStyle !== 'single',
        'Nella modalità Unico dispositivo squadra e ruolo seguono automaticamente la fase',
      );
      ensure(action.team === 'red' || action.team === 'blue', 'Squadra non valida');
      ensure(action.role === 'spy' || action.role === 'guesser', 'Ruolo non valido');
      ensure(
        action.role !== 'spy' ||
          !g.players.some(
            (p) =>
              p.id !== actorId &&
              (g.playStyle === 'shared' || p.team === action.team) &&
              p.role === 'spy',
          ),
        'Suggeritore già presente',
      );
      actor.team = g.playStyle === 'shared' ? 'red' : action.team;
      actor.role = action.role;
      actor.ready = false;
      break;
    case 'ready':
      lobby();
      actor.ready = action.ready;
      break;
    case 'shuffle': {
      host();
      lobby();
      ensure(
        g.playStyle === 'classic',
        'In questa modalità i dispositivi seguono la squadra di turno',
      );
      const spies = shuffle(
        g.players.filter((p) => p.role === 'spy'),
        random,
      );
      ensure(spies.length <= 2, 'Sono ammessi al massimo due suggeritori');
      const teams = shuffle<Team>(['red', 'blue'], random);
      const remaining = {
        red: Math.ceil(g.players.length / 2),
        blue: Math.floor(g.players.length / 2),
      };
      spies.forEach((p, i) => {
        const team = teams[i]!;
        p.team = remaining[team] > 0 ? team : other(team);
        remaining[p.team]--;
      });
      const slots = shuffle<Team>(
        [...Array<Team>(remaining.red).fill('red'), ...Array<Team>(remaining.blue).fill('blue')],
        random,
      );
      shuffle(
        g.players.filter((p) => p.role === 'guesser'),
        random,
      ).forEach((p, i) => {
        p.team = slots[i]!;
      });
      g.players.forEach((p) => {
        p.ready = false;
      });
      break;
    }
    case 'start': {
      host();
      lobby();
      ensure(
        validLobby(g),
        g.playStyle === 'single'
          ? 'Conferma che il telefono è pronto per avviare Unico dispositivo'
          : g.playStyle === 'shared'
            ? 'Servono almeno 2 dispositivi pronti e connessi: uno per i suggeritori e almeno uno per i decifratori'
            : 'Servono almeno 4 persone pronte e connesse, un suggeritore e almeno un decifratore per squadra',
      );
      const b = board(random, g.language ?? 'it');
      g.board = b.cards;
      g.active = b.first;
      g.phase = 'clue';
      g.turnEndsAt = g.turnSeconds ? now + g.turnSeconds * 1000 : null;
      g.round++;
      g.turn++;
      g.winner = null;
      g.reason = null;
      g.guesses = 0;
      g.remaining = null;
      g.clue = null;
      g.history = [
        `Missione ${g.round}. Inizia la squadra ${g.active === 'red' ? 'rossa' : 'blu'}.`,
      ];
      break;
    }
    case 'handoff':
      ensure(
        g.playStyle !== 'classic' && (g.phase === 'clue' || g.phase === 'guess'),
        'Nessun passaggio del dispositivo da confermare',
      );
      ensure(
        action.turn === g.turn,
        'Il turno è cambiato: passa il telefono alla squadra indicata',
      );
      ensure(g.players.find((p) => p.id === g.hostId)?.connected, 'Host non disponibile');
      ensure(g.turnEndsAt == null || now < g.turnEndsAt, 'Tempo del turno scaduto');
      if (g.playStyle === 'single')
        ensure(action.phase === g.phase, 'La fase è cambiata: passa il telefono al ruolo indicato');
      actor.handoffTurn = g.turn;
      if (g.playStyle === 'single') actor.handoffPhase = g.phase;
      break;
    case 'clue': {
      active('spy', 'clue');
      const word = action.word.normalize('NFC').trim();
      ensure(
        word.length >= 2 && word.length <= 32 && /^\p{L}+(?:['’‐‑-]\p{L}+)*$/u.test(word),
        'Usa una parola di 2–32 lettere; apostrofi e trattini solo interni',
      );
      ensure(
        !g.board.some((c) => !c.revealed && normalize(c.word) === normalize(word)),
        'L’indizio è una parola ancora coperta',
      );
      ensure(
        action.count === 'infinity' ||
          (Number.isInteger(action.count) && action.count >= 0 && action.count <= 9),
        'Scegli un numero da 0 a 9 o infinito',
      );
      g.clue = { word, count: action.count };
      g.guesses = 0;
      g.remaining = action.count === 0 || action.count === 'infinity' ? null : action.count + 1;
      g.phase = 'guess';
      g.history.push(
        `${actor.nickname}: ${word} · ${action.count === 'infinity' ? '∞' : action.count}`,
      );
      break;
    }
    case 'guess': {
      active('guesser', 'guess');
      ensure(
        Number.isInteger(action.index) && action.index >= 0 && action.index < 25,
        'Carta non valida',
      );
      const c = g.board[action.index]!;
      ensure(!c.revealed, 'Carta già scoperta');
      c.revealed = true;
      c.selectedBy = g.active;
      g.guesses++;
      if (g.remaining !== null) g.remaining--;
      g.history.push(
        `${actor.nickname}: ${c.word} → ${{ red: 'rossa', blue: 'blu', neutral: 'neutrale', assassin: 'assassino' }[c.color]}`,
      );
      if (c.color === 'assassin')
        win(g, other(g.active), 'Assassino: perde la squadra che lo ha scelto.');
      else if ((c.color === 'red' || c.color === 'blue') && counters(g)[c.color] === 0)
        win(g, c.color, 'Tutti gli agenti della squadra vincente sono stati scoperti.');
      else if (c.color !== g.active || g.remaining === 0) next(g, now);
      break;
    }
    case 'end':
      active('guesser', 'guess');
      ensure(g.guesses >= 1, 'Effettua almeno un tentativo prima di passare');
      next(g, now);
      break;
    case 'cancel':
      host();
      ensure(g.phase === 'clue' || g.phase === 'guess', 'Nessuna partita da annullare');
      g.phase = 'finished';
      g.turnEndsAt = null;
      g.reason = 'Partita annullata dall’host.';
      g.winner = null;
      g.history.push(g.reason);
      break;
    case 'lobby':
      host();
      ensure(g.phase === 'finished', 'Concludi o annulla prima la partita');
      g.phase = 'lobby';
      g.turnEndsAt = null;
      g.board = [];
      g.clue = null;
      g.players.forEach((p) => {
        p.ready = g.playStyle === 'single';
      });
      break;
    case 'remove':
      host();
      lobby();
      ensure(action.playerId !== g.hostId, 'L’host non può rimuovere sé stesso');
      ensure(
        g.players.some((p) => p.id === action.playerId),
        'Partecipante non presente',
      );
      g.players = g.players.filter((p) => p.id !== action.playerId);
      break;
    case 'sync':
    case 'probe':
      return g;
    default:
      throw new Error('Comando non riconosciuto');
  }
  g.history = g.history.slice(-MAX_HISTORY);
  g.version++;
  return g;
}
