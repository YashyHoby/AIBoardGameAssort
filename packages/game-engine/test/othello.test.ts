import { describe, expect, it } from 'vitest';

import {
  applyOthelloAction,
  createOthelloState,
  getLegalMoves,
  getScore,
  type OthelloState,
} from '../src';

function createPlayingState(): OthelloState {
  return createOthelloState({
    sessionId: 'test-session',
    blackPlayer: { id: 'black-user', name: 'Black', connected: true },
    whitePlayer: { id: 'white-user', name: 'White', connected: true },
  });
}

describe('Othello game engine', () => {
  it('starts with exactly four legal moves for black', () => {
    const state = createPlayingState();
    expect(getLegalMoves(state.board, 'black')).toEqual([
      { row: 2, col: 3 },
      { row: 3, col: 2 },
      { row: 4, col: 5 },
      { row: 5, col: 4 },
    ]);
  });

  it('places a disc, flips enclosed discs, and changes turns', () => {
    const state = createPlayingState();
    const next = applyOthelloAction(state, {
      type: 'place_disc',
      gameId: 'othello',
      sessionId: state.sessionId,
      actionId: 'action-1',
      playerId: 'black-user',
      stateVersion: 0,
      payload: { row: 2, col: 3 },
    });

    expect(next.board[2][3]).toBe('black');
    expect(next.board[3][3]).toBe('black');
    expect(next.currentTurn).toBe('white');
    expect(next.stateVersion).toBe(1);
    expect(getScore(next.board)).toEqual({ black: 4, white: 1 });
  });

  it('rejects an illegal move', () => {
    const state = createPlayingState();
    expect(() =>
      applyOthelloAction(state, {
        type: 'place_disc',
        gameId: 'othello',
        sessionId: state.sessionId,
        actionId: 'action-2',
        playerId: 'black-user',
        stateVersion: 0,
        payload: { row: 0, col: 0 },
      }),
    ).toThrow(/置けません/);
  });

  it('rejects a move from the wrong player', () => {
    const state = createPlayingState();
    expect(() =>
      applyOthelloAction(state, {
        type: 'place_disc',
        gameId: 'othello',
        sessionId: state.sessionId,
        actionId: 'action-3',
        playerId: 'white-user',
        stateVersion: 0,
        payload: { row: 2, col: 3 },
      }),
    ).toThrow(/相手の手番/);
  });

  it('finishes when a player resigns', () => {
    const state = createPlayingState();
    const next = applyOthelloAction(state, {
      type: 'resign',
      gameId: 'othello',
      sessionId: state.sessionId,
      actionId: 'action-4',
      playerId: 'black-user',
      stateVersion: 0,
      payload: {},
    });

    expect(next.phase).toBe('finished');
    expect(next.winner).toBe('white');
  });

  it('allows a pass only when no legal move exists and finishes after both players are blocked', () => {
    const state = createPlayingState();
    state.currentTurn = 'white';
    state.board = Array.from({ length: 8 }, () =>
      Array(8).fill('black'),
    );

    const next = applyOthelloAction(state, {
      type: 'pass',
      gameId: 'othello',
      sessionId: state.sessionId,
      actionId: 'action-5',
      playerId: 'white-user',
      stateVersion: 0,
      payload: {},
    });

    expect(next.phase).toBe('finished');
    expect(next.winner).toBe('black');
    expect(next.metadata.passCount).toBe(1);
  });
});
