import type { OthelloState } from '../../../packages/game-engine/src/othello.ts';
import { HttpError } from './http.ts';

type AdminClient = {
  from: (table: string) => any;
};

export async function readOthelloRoom(
  admin: AdminClient,
  roomId: string,
  userId: string,
): Promise<{ roomId: string; sessionId: string; state: OthelloState }> {
  const { data: membership, error: membershipError } = await admin
    .from('room_members')
    .select('room_id')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }
  if (!membership) {
    throw new HttpError(403, 'ROOM_FORBIDDEN', 'このルームへ参加していません。');
  }

  const { data: gameSession, error: sessionError } = await admin
    .from('game_sessions')
    .select('id, room_id, state, state_version')
    .eq('room_id', roomId)
    .single();
  if (sessionError || !gameSession) {
    throw new HttpError(404, 'ROOM_NOT_FOUND', '対局が見つかりません。');
  }

  return {
    roomId: gameSession.room_id,
    sessionId: gameSession.id,
    state: gameSession.state as OthelloState,
  };
}

