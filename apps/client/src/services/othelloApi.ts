import type { OthelloAction, OthelloState } from '@boardgame/game-engine';

import { getSupabase } from './supabase';

export type OthelloRoomPayload = {
  roomId: string;
  sessionId: string;
  state: OthelloState;
};

async function invoke<T>(functionName: string, body: unknown): Promise<T> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: body as Record<string, unknown>,
  });
  if (error) {
    throw error;
  }
  if (!data || data.error) {
    throw new Error(data?.message ?? data?.error ?? 'サーバー処理に失敗しました。');
  }
  return data as T;
}

export function createOthelloRoom(displayName: string): Promise<OthelloRoomPayload> {
  return invoke('create-othello-room', { displayName });
}

export function joinOthelloRoom(
  roomId: string,
  displayName: string,
): Promise<OthelloRoomPayload> {
  return invoke('join-othello-room', { roomId, displayName });
}

export function getOthelloRoom(roomId: string): Promise<OthelloRoomPayload> {
  return invoke('get-othello-room', { roomId });
}

export function submitOthelloAction(
  sessionId: string,
  action: OthelloAction,
): Promise<OthelloRoomPayload> {
  return invoke('submit-othello-action', { sessionId, action });
}

export function subscribeToRoom(
  roomId: string,
  onStateChanged: () => void,
): () => void {
  const supabase = getSupabase();
  let isDisposed = false;
  let channel: ReturnType<typeof supabase.channel> | null = null;

  void (async () => {
    await supabase.realtime.setAuth();
    if (isDisposed) {
      return;
    }
    channel = supabase
      .channel(`room:${roomId}`, { config: { private: true } })
      .on('broadcast', { event: 'state_updated' }, onStateChanged)
      .subscribe();
  })();

  return () => {
    isDisposed = true;
    if (channel) {
      void supabase.removeChannel(channel);
    }
  };
}
