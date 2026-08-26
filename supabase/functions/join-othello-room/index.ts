import type { OthelloState } from '../../../packages/game-engine/src/othello.ts';
import {
  createAdminClient,
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  requireUser,
  stringField,
} from '../_shared/http.ts';
import { readOthelloRoom } from '../_shared/room.ts';

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
    const roomId = stringField(body.roomId, 'roomId');
    const displayName = stringField(body.displayName, 'displayName').slice(0, 40);
    const admin = createAdminClient();

    const { data: existingMembership, error: membershipLookupError } = await admin
      .from('room_members')
      .select('room_id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (membershipLookupError) {
      throw membershipLookupError;
    }
    if (existingMembership) {
      return jsonResponse(await readOthelloRoom(admin, roomId, user.id));
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: user.id,
      display_name: displayName,
    });
    if (profileError) {
      throw profileError;
    }

    const { data: gameSession, error: sessionError } = await admin
      .from('game_sessions')
      .select('id, room_id, state, state_version')
      .eq('room_id', roomId)
      .single();
    if (sessionError || !gameSession) {
      throw new HttpError(404, 'ROOM_NOT_FOUND', '対局が見つかりません。');
    }

    const current = gameSession.state as OthelloState;
    const state: OthelloState = {
      ...current,
      phase: 'playing',
      stateVersion: gameSession.state_version + 1,
      players: {
        ...current.players,
        white: {
          id: user.id,
          name: displayName,
          color: 'white',
          connected: true,
        },
      },
    };
    const { error: joinError } = await admin.rpc('commit_othello_room_join', {
      p_room_id: roomId,
      p_user_id: user.id,
      p_session_id: gameSession.id,
      p_expected_state_version: gameSession.state_version,
      p_next_state: state,
    });
    if (joinError) {
      throw new HttpError(409, 'ROOM_FULL', 'このルームはすでに2人が参加しているか、状態が更新されています。');
    }

    return jsonResponse({ roomId, sessionId: gameSession.id, state });
  } catch (error) {
    return errorResponse(error);
  }
});
