import { describe, expect, it } from 'vitest';
import { apply, newGame, project } from '../src/core/engine';
import type { Color, Player } from '../src/core/model';
import { revealedCard, revealPresentation } from '../src/session/reveal';
import { needsHandoff } from '../src/core/model';

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
  it.each(['red', 'neutral', 'blue', 'assassin'] as const)(
    'mantiene il tabellone prima del passaggio o della fine dopo una carta %s',
    (color) => {
      const player: Player = {
        id: 'phone',
        nickname: 'Telefono',
        team: 'red',
        role: 'guesser',
        ready: true,
        connected: true,
      };
      let game = newGame('single', player, null, 'single');
      game = apply(game, player.id, { type: 'start' }, () => 0);
      game = apply(game, player.id, { type: 'handoff', turn: game.turn, phase: 'clue' }, () => 0);
      game = apply(game, player.id, { type: 'clue', word: 'Ineffabile', count: 2 }, () => 0);
      game = apply(game, player.id, { type: 'handoff', turn: game.turn, phase: 'guess' }, () => 0);
      // A correct card can also end the turn when it uses the last attempt.
      if (color === 'red') game.remaining = 1;
      const index = game.board.findIndex((card) => card.color === color);
      const previous = project(game, player.id);
      const current = project(
        apply(game, player.id, { type: 'guess', index }, () => 0),
        player.id,
      );
      const presentation = revealPresentation(previous, current)!;
      expect(presentation.event.color).toBe(color);
      expect(presentation.view.phase).toBe('guess');
      expect(presentation.view.turn).toBe(previous.turn);
      expect(presentation.view.active).toBe(previous.active);
      expect(needsHandoff(presentation.view, presentation.view.players[0])).toBe(false);
      expect(presentation.view.board[index]).toMatchObject({ revealed: true, color });
      expect(presentation.view.board.filter((card) => card.revealed)).toHaveLength(1);
      expect(
        presentation.view.board.filter((card) => !card.revealed).every((card) => !card.color),
      ).toBe(true);
      expect(presentation.view.counters).toEqual(current.counters);
      expect(current.phase === 'finished' || needsHandoff(current, current.players[0])).toBe(true);
      expect(previous.board[index]?.revealed).toBe(false);
    },
  );
  it('il feedback del suggeritore mostra solo i colori pubblici senza modificare la mappa', () => {
    const game = guessing();
    const index = game.board.findIndex((card) => card.color === game.active);
    const previous = project(game, 'a');
    const current = project(
      apply(game, game.active === 'red' ? 'b' : 'd', { type: 'guess', index }, () => 0),
      'a',
    );
    expect(previous.board.every((card) => card.color)).toBe(true);
    const presentation = revealPresentation(previous, current)!;
    expect(presentation.view.board[index]?.color).toBe(game.active);
    expect(
      presentation.view.board.filter((card) => !card.revealed).every((card) => !card.color),
    ).toBe(true);
    expect(previous.board.every((card) => card.color)).toBe(true);
    expect(revealPresentation(previous, previous)).toBeNull();
  });
});
