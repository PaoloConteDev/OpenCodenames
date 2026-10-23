import { apply, expireTurn, newGame, project } from '../core/engine';
import {
  Game,
  Player,
  PlayStyle,
  RandomInt,
  Team,
  ensure,
  other,
  playerLimit,
} from '../core/model';
import { Command, Credentials, Receipt, nickname } from '../protocol/messages';
import { languageOrItalian, type Language } from '../content/languages';
export type Mode = 'bluetooth' | 'lan' | 'local';
export type Session = { playerId: string; token: string; receipts: Receipt[] };
export type HostStore = {
  schema: 1;
  game: Game;
  sessions: Session[];
  mode: Mode;
  roomCode: string;
  relayIdentity?: { publicKey: string; secretKey: string };
  nextJoinTeam?: Team;
  pausedTurnMs?: number | null;
};
export type Storage = { save(data: HostStore): Promise<void> };
export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** All mutations, including presence, are serialized; durable commit precedes acknowledgements. */
export class Authority {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(
    public data: HostStore,
    private storage: Storage,
    private token: () => string,
    private random: RandomInt,
    private now: () => number = Date.now,
  ) {
    this.data = {
      ...data,
      game: {
        ...data.game,
        playStyle: data.game.playStyle ?? 'classic',
        language: languageOrItalian(data.game.language),
        turn: data.game.turn ?? 0,
        turnSeconds: data.game.turnSeconds ?? null,
        turnEndsAt: data.game.turnEndsAt ?? null,
      },
    };
  }
  static create(
    name: string,
    mode: Mode,
    token: () => string,
    random: RandomInt,
    storage: Storage,
    turnSeconds: number | null = null,
    playStyle: PlayStyle = 'classic',
    language: Language = 'it',
  ): Authority {
    mode = playStyle === 'single' ? 'local' : mode;
    ensure(
      mode !== 'local' || playStyle === 'single',
      'Il trasporto locale richiede Unico dispositivo',
    );
    const host: Player = {
      id: token(),
      nickname: nickname(name),
      team: 'red',
      role: playStyle === 'shared' ? 'spy' : 'guesser',
      ready: playStyle === 'single',
      connected: true,
    };
    return new Authority(
      {
        schema: 1,
        game: newGame(token(), host, turnSeconds, playStyle, language),
        sessions: [{ playerId: host.id, token: token(), receipts: [] }],
        mode,
        roomCode: token().slice(0, 6).toUpperCase(),
        nextJoinTeam: 'blue',
      },
      storage,
      token,
      random,
    );
  }
  private queue<T>(work: () => Promise<T>): Promise<T> {
    const p = this.tail.then(work);
    this.tail = p.catch(() => undefined);
    return p;
  }
  private async commit(next: HostStore) {
    await this.storage.save(clone(next));
    this.data = next;
  }
  save() {
    return this.queue(() => this.commit(clone(this.data)));
  }
  relayIdentity(create: () => { publicKey: string; secretKey: string }) {
    return this.queue(async () => {
      if (this.data.relayIdentity) return this.data.relayIdentity;
      const n = clone(this.data);
      n.relayIdentity = create();
      await this.commit(n);
      return n.relayIdentity;
    });
  }
  recover() {
    return this.queue(async () => {
      const n = clone(this.data);
      n.game.players.forEach((p) => {
        p.connected = p.id === n.game.hostId;
        if (n.game.playStyle === 'single') {
          delete p.handoffTurn;
          delete p.handoffPhase;
        }
      });
      if (n.game.turnEndsAt != null) {
        n.pausedTurnMs = Math.max(0, n.game.turnEndsAt - this.now());
        n.game.turnEndsAt = null;
      }
      n.game.version++;
      await this.commit(n);
    });
  }
  view(playerId: string) {
    return project(this.data.game, playerId);
  }
  pauseClock() {
    return this.queue(async () => {
      if (this.data.game.turnEndsAt == null) return;
      const n = clone(this.data);
      n.pausedTurnMs = Math.max(0, n.game.turnEndsAt! - this.now());
      n.game.turnEndsAt = null;
      n.game.version++;
      await this.commit(n);
    });
  }
  resumeClock() {
    return this.queue(async () => {
      const g = this.data.game;
      if (!g.turnSeconds || g.turnEndsAt != null || (g.phase !== 'clue' && g.phase !== 'guess'))
        return;
      const n = clone(this.data);
      n.game.turnEndsAt = this.now() + (n.pausedTurnMs ?? g.turnSeconds * 1000);
      n.pausedTurnMs = null;
      n.game.version++;
      await this.commit(n);
    });
  }
  advanceClock() {
    return this.queue(async () => {
      const game = expireTurn(this.data.game, this.now());
      if (!game) return false;
      const n = clone(this.data);
      n.game = game;
      await this.commit(n);
      return true;
    });
  }
  authenticate(c: Credentials): string {
    ensure(c.gameId === this.data.game.id, 'La sessione appartiene a un’altra partita');
    const s = this.data.sessions.find((x) => x.playerId === c.playerId);
    ensure(
      s && s.token === c.token && c.playerId !== this.data.game.hostId,
      'Credenziale non valida o partecipante rimosso',
    );
    return s.playerId;
  }
  join(name: string): Promise<Credentials> {
    return this.queue(async () => {
      const n = clone(this.data);
      ensure(
        n.game.playStyle !== 'single',
        'Unico dispositivo usa un solo telefono e non ammette altri ingressi',
      );
      ensure(n.game.phase === 'lobby', 'La partita è già iniziata');
      const limit = playerLimit(n.mode);
      ensure(
        n.game.players.length < limit,
        `Stanza piena (massimo ${limit} dispositivi in questa modalità)`,
      );
      const player: Player = {
        id: this.token(),
        nickname: nickname(name),
        team:
          n.game.playStyle === 'shared'
            ? 'red'
            : (n.nextJoinTeam ?? (n.game.players.length % 2 === 0 ? 'red' : 'blue')),
        role: 'guesser',
        ready: false,
        connected: true,
      };
      n.game.players.push(player);
      n.nextJoinTeam = other(player.team);
      const token = this.token();
      n.sessions.push({ playerId: player.id, token, receipts: [] });
      n.game.version++;
      await this.commit(n);
      return { gameId: n.game.id, playerId: player.id, token };
    });
  }
  presence(playerId: string, connected: boolean) {
    return this.queue(async () => {
      const n = clone(this.data);
      const p = n.game.players.find((x) => x.id === playerId);
      if (!p || p.connected === connected) return;
      p.connected = connected;
      n.game.version++;
      await this.commit(n);
    });
  }
  execute(playerId: string, cmd: Command): Promise<Receipt> {
    return this.queue(async () => {
      const n = clone(this.data);
      const session = n.sessions.find((s) => s.playerId === playerId);
      ensure(session, 'Sessione non valida');
      ensure(cmd.gameId === n.game.id, 'Partita diversa: comando rifiutato');
      const duplicate = session.receipts.find((x) => x.id === cmd.id);
      if (duplicate) return clone(duplicate);
      let receipt: Receipt;
      const now = this.now();
      n.game = expireTurn(n.game, now) ?? n.game;
      try {
        if (
          cmd.action.type !== 'sync' &&
          cmd.action.type !== 'probe' &&
          cmd.action.type !== 'handoff'
        )
          ensure(
            cmd.version === n.game.version,
            'Stato aggiornato da un altro giocatore. Rivedi il tabellone e riprova.',
          );
        n.game = apply(n.game, playerId, cmd.action, this.random, now);
        if (cmd.action.type === 'remove')
          n.sessions = n.sessions.filter(
            (s) => s.playerId !== (cmd.action as { playerId: string }).playerId,
          );
        receipt = { id: cmd.id, ok: true, version: n.game.version };
      } catch (e) {
        receipt = {
          id: cmd.id,
          ok: false,
          version: n.game.version,
          error: e instanceof Error ? e.message : 'Comando rifiutato',
        };
      }
      const current = n.sessions.find((s) => s.playerId === playerId)!;
      current.receipts.push(receipt);
      current.receipts = current.receipts.slice(-256);
      await this.commit(n);
      return receipt;
    });
  }
}
