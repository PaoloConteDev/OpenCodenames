import type { Color, Team, View } from '../core/model';

export type RevealKind = 'correct' | 'opponent' | 'neutral' | 'assassin';
export type RevealEvent = {
  id: string;
  gameId: string;
  round: number;
  index: number;
  word: string;
  color: Color;
  team: Team;
  kind: RevealKind;
};

export type RevealPresentation = { event: RevealEvent; view: View };

/** Hold the public board on the previous turn while its result is displayed. */
export function revealPresentation(
  previous: View | null,
  current: View | null,
): RevealPresentation | null {
  const event = revealedCard(previous, current);
  if (!event || !previous || !current) return null;
  return {
    event,
    view: {
      ...previous,
      counters: current.counters,
      board: previous.board.map((card, index) => {
        if (index === event.index)
          return { ...card, revealed: true, color: event.color, selectedBy: event.team };
        // Never carry a private map into the translucent result dialog.
        return card.revealed ? card : { word: card.word, revealed: false };
      }),
    },
  };
}

/** Compare public snapshots only; private map visibility is never a reveal. */
export function revealedCard(previous: View | null, current: View | null): RevealEvent | null {
  if (
    !previous ||
    !current ||
    previous.id !== current.id ||
    previous.round !== current.round ||
    previous.phase === 'lobby' ||
    current.phase === 'lobby' ||
    current.version <= previous.version ||
    previous.board.length !== current.board.length ||
    previous.board.some((card, i) => card.word !== current.board[i]?.word)
  )
    return null;
  const indices = current.board.flatMap((card, i) =>
    card.revealed && !previous.board[i]?.revealed ? [i] : [],
  );
  // A single accepted guess reveals one card; a catch-up snapshot is silent.
  if (indices.length !== 1) return null;
  const index = indices[0]!;
  const card = current.board[index]!;
  if (!card.color || !card.selectedBy) return null;
  return {
    id: `${current.id}:${current.round}:${current.version}:${index}`,
    gameId: current.id,
    round: current.round,
    index,
    word: card.word,
    color: card.color,
    team: card.selectedBy,
    kind:
      card.color === 'assassin' || card.color === 'neutral'
        ? card.color
        : card.color === card.selectedBy
          ? 'correct'
          : 'opponent',
  };
}
