export type Disc = 'black' | 'white';
export type Cell = Disc | 'empty';
export type Board = Cell[][];
export type OthelloPhase = 'waiting' | 'playing' | 'finished';
export type Winner = Disc | 'draw' | null;

export type Player = {
  id: string;
  name: string;
  color: Disc;
  connected: boolean;
};

export type Position = {
  row: number;
  col: number;
};

export type OthelloState = {
  gameId: 'othello';
  sessionId: string;
  stateVersion: number;
  phase: OthelloPhase;
  currentTurn: Disc;
  board: Board;
  players: {
    black: Player;
    white: Player;
  };
  winner: Winner;
  lastActionId: string | null;
  turnCount: number;
  metadata: {
    passCount: number;
  };
};

export type PlaceDiscAction = {
  type: 'place_disc';
  gameId: 'othello';
  sessionId: string;
  actionId: string;
  playerId: string;
  stateVersion: number;
  payload: Position;
};

export type PassAction = {
  type: 'pass';
  gameId: 'othello';
  sessionId: string;
  actionId: string;
  playerId: string;
  stateVersion: number;
  payload: Record<string, never>;
};

export type ResignAction = {
  type: 'resign';
  gameId: 'othello';
  sessionId: string;
  actionId: string;
  playerId: string;
  stateVersion: number;
  payload: Record<string, never>;
};

export type OthelloAction = PlaceDiscAction | PassAction | ResignAction;

export type OthelloRuleErrorCode =
  | 'INVALID_MOVE'
  | 'NOT_YOUR_TURN'
  | 'GAME_FINISHED'
  | 'INVALID_VERSION'
  | 'ROOM_FORBIDDEN'
  | 'INVALID_ACTION';

export class OthelloRuleError extends Error {
  constructor(
    public readonly code: OthelloRuleErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'OthelloRuleError';
  }
}

const BOARD_SIZE = 8;
const DIRECTIONS: ReadonlyArray<Position> = [
  { row: -1, col: -1 },
  { row: -1, col: 0 },
  { row: -1, col: 1 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
  { row: 1, col: -1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];

export function opponent(color: Disc): Disc {
  return color === 'black' ? 'white' : 'black';
}

export function createInitialBoard(): Board {
  const board = Array.from({ length: BOARD_SIZE }, () =>
    Array<Cell>(BOARD_SIZE).fill('empty'),
  );
  board[3][3] = 'white';
  board[3][4] = 'black';
  board[4][3] = 'black';
  board[4][4] = 'white';
  return board;
}

export function createOthelloState(input: {
  sessionId: string;
  blackPlayer: Omit<Player, 'color'>;
  whitePlayer: Omit<Player, 'color'>;
  phase?: OthelloPhase;
}): OthelloState {
  return {
    gameId: 'othello',
    sessionId: input.sessionId,
    stateVersion: 0,
    phase: input.phase ?? 'playing',
    currentTurn: 'black',
    board: createInitialBoard(),
    players: {
      black: { ...input.blackPlayer, color: 'black' },
      white: { ...input.whitePlayer, color: 'white' },
    },
    winner: null,
    lastActionId: null,
    turnCount: 0,
    metadata: { passCount: 0 },
  };
}

export function isInBounds({ row, col }: Position): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function getFlipsForMove(
  board: Board,
  color: Disc,
  position: Position,
): Position[] {
  if (!isInBounds(position) || board[position.row][position.col] !== 'empty') {
    return [];
  }

  const enemy = opponent(color);
  const flips: Position[] = [];

  for (const direction of DIRECTIONS) {
    const candidate: Position[] = [];
    let row = position.row + direction.row;
    let col = position.col + direction.col;

    while (isInBounds({ row, col }) && board[row][col] === enemy) {
      candidate.push({ row, col });
      row += direction.row;
      col += direction.col;
    }

    if (
      candidate.length > 0 &&
      isInBounds({ row, col }) &&
      board[row][col] === color
    ) {
      flips.push(...candidate);
    }
  }

  return flips;
}

export function getLegalMoves(board: Board, color: Disc): Position[] {
  const moves: Position[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (getFlipsForMove(board, color, { row, col }).length > 0) {
        moves.push({ row, col });
      }
    }
  }
  return moves;
}

export function getScore(board: Board): Record<Disc, number> {
  return board.flat().reduce(
    (score, cell) => {
      if (cell === 'black' || cell === 'white') {
        score[cell] += 1;
      }
      return score;
    },
    { black: 0, white: 0 },
  );
}

export function getWinner(board: Board): Exclude<Winner, null> {
  const score = getScore(board);
  if (score.black === score.white) {
    return 'draw';
  }
  return score.black > score.white ? 'black' : 'white';
}

export function isBoardFull(board: Board): boolean {
  return board.every((row) => row.every((cell) => cell !== 'empty'));
}

function bothPlayersHaveNoMoves(board: Board): boolean {
  return (
    getLegalMoves(board, 'black').length === 0 &&
    getLegalMoves(board, 'white').length === 0
  );
}

function finish(state: OthelloState, lastActionId: string): OthelloState {
  return {
    ...state,
    phase: 'finished',
    winner: getWinner(state.board),
    lastActionId,
    stateVersion: state.stateVersion + 1,
  };
}

function getPlayerColor(state: OthelloState, playerId: string): Disc | null {
  if (state.players.black.id === playerId) {
    return 'black';
  }
  if (state.players.white.id === playerId) {
    return 'white';
  }
  return null;
}

function validateActionEnvelope(state: OthelloState, action: OthelloAction): Disc {
  if (state.phase !== 'playing') {
    throw new OthelloRuleError('GAME_FINISHED', 'この対局は進行中ではありません。');
  }
  if (action.gameId !== 'othello' || action.sessionId !== state.sessionId) {
    throw new OthelloRuleError('INVALID_ACTION', '対象のゲームセッションが一致しません。');
  }
  if (action.stateVersion !== state.stateVersion) {
    throw new OthelloRuleError('INVALID_VERSION', 'ゲーム状態が古いため、再同期が必要です。');
  }

  const playerColor = getPlayerColor(state, action.playerId);
  if (!playerColor) {
    throw new OthelloRuleError('ROOM_FORBIDDEN', 'このプレイヤーは対局に参加していません。');
  }
  return playerColor;
}

export function applyOthelloAction(
  state: OthelloState,
  action: OthelloAction,
): OthelloState {
  const playerColor = validateActionEnvelope(state, action);

  if (action.type === 'resign') {
    return {
      ...state,
      phase: 'finished',
      winner: opponent(playerColor),
      lastActionId: action.actionId,
      stateVersion: state.stateVersion + 1,
    };
  }

  if (playerColor !== state.currentTurn) {
    throw new OthelloRuleError('NOT_YOUR_TURN', '現在は相手の手番です。');
  }

  if (action.type === 'pass') {
    if (getLegalMoves(state.board, playerColor).length > 0) {
      throw new OthelloRuleError('INVALID_MOVE', '合法手があるためパスできません。');
    }

    const nextState: OthelloState = {
      ...state,
      currentTurn: opponent(playerColor),
      lastActionId: action.actionId,
      stateVersion: state.stateVersion + 1,
      metadata: { passCount: state.metadata.passCount + 1 },
    };
    return bothPlayersHaveNoMoves(nextState.board)
      ? { ...nextState, phase: 'finished', winner: getWinner(nextState.board) }
      : nextState;
  }

  const flips = getFlipsForMove(state.board, playerColor, action.payload);
  if (flips.length === 0) {
    throw new OthelloRuleError('INVALID_MOVE', 'そのマスには石を置けません。');
  }

  const board = cloneBoard(state.board);
  board[action.payload.row][action.payload.col] = playerColor;
  for (const flip of flips) {
    board[flip.row][flip.col] = playerColor;
  }

  const nextState: OthelloState = {
    ...state,
    board,
    currentTurn: opponent(playerColor),
    lastActionId: action.actionId,
    stateVersion: state.stateVersion + 1,
    turnCount: state.turnCount + 1,
    metadata: { passCount: 0 },
  };

  return isBoardFull(board) || bothPlayersHaveNoMoves(board)
    ? { ...nextState, phase: 'finished', winner: getWinner(board) }
    : nextState;
}

