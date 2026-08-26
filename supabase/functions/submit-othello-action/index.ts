import {
  applyOthelloAction,
  OthelloRuleError,
  type OthelloAction,
  type OthelloState,
} from '../../../packages/game-engine/src/othello.ts';
import {
  createAdminClient,
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  requireUser,
  stringField,
} from '../_shared/http.ts';

const actionTypes = new Set(['place_disc', 'pass', 'resign']);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  try {
    const user = await requireUser(request);
    const body = await request.json();
    const sessionId = stringField(body.sessionId, 'sessionId');
    if (
      !body.action ||
      typeof body.action !== 'object' ||
      !actionTypes.has(body.action.type)
    ) {
      throw new HttpError(400, 'INVALID_ACTION', 'アクション形式が正しくありません。');
    }
    const rawAction = body.action as Record<string, unknown>;
    const actionId = stringField(rawAction.actionId, 'actionId');
    if (!Number.isInteger(rawAction.stateVersion) || rawAction.stateVersion < 0) {
      throw new HttpError(400, 'INVALID_ACTION', 'stateVersionが正しくありません。');
    }
    if (rawAction.type === 'place_disc') {
      const payload = rawAction.payload as Record<string, unknown> | undefined;
      if (
        !payload ||
        !Number.isInteger(payload.row) ||
        !Number.isInteger(payload.col)
      ) {
        throw new HttpError(400, 'INVALID_ACTION', '置く座標が正しくありません。');
      }
    }

    const admin = createAdminClient();
    const { data: gameSession, error: sessionError } = await admin
      .from('game_sessions')
      .select('id, room_id, state, state_version')
      .eq('id', sessionId)
      .single();
    if (sessionError || !gameSession) {
      throw new HttpError(404, 'SESSION_NOT_FOUND', '対局が見つかりません。');
    }

    const { data: membership, error: membershipError } = await admin
      .from('room_members')
      .select('user_id')
      .eq('room_id', gameSession.room_id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (membershipError) {
      throw membershipError;
    }
    if (!membership) {
      throw new HttpError(403, 'ROOM_FORBIDDEN', 'この対局に参加していません。');
    }

    const state = gameSession.state as OthelloState;
    const action = {
      ...rawAction,
      actionId,
      sessionId,
      playerId: user.id,
      gameId: 'othello',
    } as OthelloAction;
    const nextState = applyOthelloAction(state, action);

    const { error: commitError } = await admin.rpc('commit_othello_action', {
      p_session_id: sessionId,
      p_expected_state_version: state.stateVersion,
      p_action_id: action.actionId,
      p_actor_id: user.id,
      p_action_type: action.type,
      p_payload: action.payload,
      p_next_state: nextState,
    });
    if (commitError) {
      throw new HttpError(409, 'INVALID_VERSION', '状態の更新に競合しました。再同期してください。');
    }

    return jsonResponse({
      roomId: gameSession.room_id,
      sessionId,
      state: nextState,
    });
  } catch (error) {
    if (error instanceof OthelloRuleError) {
      return jsonResponse({ error: error.code, message: error.message }, 400);
    }
    return errorResponse(error);
  }
});
