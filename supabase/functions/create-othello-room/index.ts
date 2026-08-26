import { createOthelloState } from '../../../packages/game-engine/src/othello.ts';
import {
  createAdminClient,
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  requireUser,
  stringField,
} from '../_shared/http.ts';

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
    const displayName = stringField(body.displayName, 'displayName').slice(0, 40);
    const admin = createAdminClient();
    const roomId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();

    const { error: profileError } = await admin.from('profiles').upsert({
      id: user.id,
      display_name: displayName,
    });
    if (profileError) {
      throw profileError;
    }

    const state = createOthelloState({
      sessionId,
      blackPlayer: { id: user.id, name: displayName, connected: true },
      whitePlayer: {
        id: 'waiting-white-player',
        name: '対戦相手を待っています',
        connected: false,
      },
      phase: 'waiting',
    });

    const { error: roomError } = await admin.from('rooms').insert({
      id: roomId,
      game_id: 'othello',
      status: 'waiting',
      created_by: user.id,
    });
    if (roomError) {
      throw roomError;
    }

    const { error: memberError } = await admin.from('room_members').insert({
      room_id: roomId,
      user_id: user.id,
      color: 'black',
    });
    if (memberError) {
      throw memberError;
    }

    const { error: sessionError } = await admin.from('game_sessions').insert({
      id: sessionId,
      room_id: roomId,
      game_id: 'othello',
      state,
      state_version: state.stateVersion,
    });
    if (sessionError) {
      throw sessionError;
    }

    return jsonResponse({ roomId, sessionId, state });
  } catch (error) {
    return errorResponse(error);
  }
});

