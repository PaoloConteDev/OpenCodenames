import { describe, expect, it } from 'vitest';
import { apply, newGame, project } from '../src/core/engine';
import type { Color, Player } from '../src/core/model';
import { revealedCard } from '../src/session/reveal';

function guessing() {
  const players: Player[] = [
    { id: 'a', nickname: 'A', team: 'red', role: 'spy', ready: true, connected: true },
    { id: 'b', nickname: 'B', team: 'red', role: 'guesser', ready: true, connected: true },
    { id: 'c', nickname: 'C', team: 'blue', role: 'spy', ready: true, connected: true },
    { id: 'd', nickname: 'D', team: 'blue', role: 'guesser', ready: true, connected: true },
  ];
  let game = newGame('room', players[0]!);
  game.players = players;
  game = apply(game, 'a', { type: 'start' }, () => 0);
  const spy = game.active === 'red' ? 'a' : 'c';
  return apply(game, spy, { type: 'clue', word: 'Ineffabile', count: 2 }, () => 0);
}

describe('feedback da rivelazioni pubbliche', () => {
  it.each(['red', 'blue', 'neutral', 'assassin'] as Color[])(
    'riconosce %s anche se la scelta cambia squadra o conclude la partita',
    (color) => {
      const before = guessing();
      const guesser = before.active === 'red' ? 'b' : 'd';
      const index = before.board.findIndex((card) => card.color === color);
      const after = apply(before, guesser, { type: 'guess', index }, () => 0);
      const oldView = project(before, guesser);
      expect(oldView.board[index]?.color).toBeUndefined();
      expect(revealedCard(oldView, project(after, guesser))).toMatchObject({
        index,
        word: before.board[index]!.word,
        color,
        team: before.active,
        kind:
          color === 'neutral' || color === 'assassin'
            ? color
            : color === before.active
              ? 'correct'
              : 'opponent',
      });
    },
  );
  it('non considera una mappa privata, un duplicato o uno snapshot vecchio come una scelta', () => {
    const game = guessing();
    expect(revealedCard(project(game, 'b'), project(game, 'a'))).toBeNull();
    const index = game.board.findIndex((card) => card.color === game.active);
    const next = project(
      apply(game, game.active === 'red' ? 'b' : 'd', { type: 'guess', index }, () => 0),
      'b',
    );
    expect(revealedCard(next, next)).toBeNull();
    expect(revealedCard(next, project(game, 'b'))).toBeNull();
    expect(revealedCard(null, next)).toBeNull();
  });
  it('rileva una scelta live anche quando arriva insieme al precedente indizio', () => {
    const game = guessing();
    const guesser = game.active === 'red' ? 'b' : 'd';
    const index = game.board.findIndex((card) => card.color === game.active);
    const previous = {
      ...project(game, guesser),
      phase: 'clue' as const,
      version: game.version - 1,
    };
    const current = project(
      apply(game, guesser, { type: 'guess', index }, () => 0),
      guesser,
    );
    expect(revealedCard(previous, current)).toMatchObject({ kind: 'correct', index });
  });
  it('ignora nuovi round, nuove stanze, catch-up multipli e attribuzioni mancanti', () => {
    const previous = project(guessing(), 'b');
    const current = structuredClone(previous);
    current.version++;
    Object.assign(current.board[0]!, { revealed: true, color: 'red', selectedBy: 'red' });
    expect(revealedCard(previous, { ...current, round: previous.round + 1 })).toBeNull();
    expect(revealedCard(previous, { ...current, id: 'another-room' })).toBeNull();
    Object.assign(current.board[1]!, { revealed: true, color: 'blue', selectedBy: 'red' });
    expect(revealedCard(previous, current)).toBeNull();
    current.board[1]!.revealed = false;
    delete current.board[0]!.selectedBy;
    expect(revealedCard(previous, current)).toBeNull();
  });
});
