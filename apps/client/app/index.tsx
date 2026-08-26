import type { Session } from '@supabase/supabase-js';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  applyOthelloAction,
  createOthelloState,
  getLegalMoves,
  getScore,
  type Disc,
  type OthelloAction,
  type OthelloState,
  type Position,
} from '@boardgame/game-engine';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { getAuthRedirectUrl } from '../src/platform/authRedirect';
import { getInviteUrl, shareInvite } from '../src/platform/shareInvite';
import {
  createOthelloRoom,
  getOthelloRoom,
  joinOthelloRoom,
  submitOthelloAction,
  subscribeToRoom,
} from '../src/services/othelloApi';
import { getSupabase, isSupabaseConfigured } from '../src/services/supabase';

type PlayMode = 'demo' | 'online';

function createDemoState(): OthelloState {
  return createOthelloState({
    sessionId: 'demo-session',
    blackPlayer: {
      id: 'demo-black',
      name: '黒プレイヤー',
      connected: true,
    },
    whitePlayer: {
      id: 'demo-white',
      name: '白プレイヤー',
      connected: true,
    },
  });
}

function createActionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function colorLabel(color: Disc): string {
  return color === 'black' ? '黒' : '白';
}

function winnerLabel(state: OthelloState): string {
  if (state.winner === 'draw') {
    return '引き分けです';
  }
  return state.winner ? `${colorLabel(state.winner)}の勝ちです` : '';
}

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ room?: string | string[] }>();
  const roomParam = Array.isArray(params.room) ? params.room[0] : params.room;
  const [mode, setMode] = useState<PlayMode>('demo');
  const [demoState, setDemoState] = useState<OthelloState>(createDemoState);
  const [onlineState, setOnlineState] = useState<OthelloState | null>(null);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('プレイヤー');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const state = mode === 'demo' ? demoState : onlineState;

  useEffect(() => {
    if (roomParam && isSupabaseConfigured) {
      setMode('online');
    }
  }, [roomParam]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }
    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadRoom = async (roomId: string) => {
    const payload = await getOthelloRoom(roomId);
    setActiveRoomId(payload.roomId);
    setOnlineState(payload.state);
    setJoinRoomId(payload.roomId);
    return payload;
  };

  useEffect(() => {
    if (
      mode !== 'online' ||
      !session ||
      !roomParam ||
      activeRoomId === roomParam
    ) {
      return;
    }
    void loadRoom(roomParam).catch(() => {
      setJoinRoomId(roomParam);
      setMessage('招待ルームです。参加ボタンを押して対局に加わってください。');
    });
  }, [mode, session, roomParam, activeRoomId]);

  useEffect(() => {
    if (mode !== 'online' || !session || !activeRoomId) {
      return;
    }
    return subscribeToRoom(activeRoomId, () => {
      void loadRoom(activeRoomId).catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : '同期に失敗しました。');
      });
    });
  }, [mode, session, activeRoomId]);

  const legalMoves = useMemo(
    () =>
      state?.phase === 'playing'
        ? getLegalMoves(state.board, state.currentTurn)
        : [],
    [state],
  );
  const legalMoveKeys = useMemo(
    () => new Set(legalMoves.map((move) => `${move.row}-${move.col}`)),
    [legalMoves],
  );
  const score = state ? getScore(state.board) : { black: 0, white: 0 };
  const activePlayer = state
    ? state.players[state.currentTurn]
    : null;
  const canAct =
    Boolean(state) &&
    state?.phase === 'playing' &&
    (mode === 'demo' || activePlayer?.id === session?.user.id);

  const switchToOnline = () => {
    if (!isSupabaseConfigured) {
      setMessage('オンライン対戦には.envのSupabase設定が必要です。セットアップガイドを参照してください。');
      return;
    }
    setMode('online');
    setMessage('');
  };

  const sendMagicLink = async () => {
    if (!email.trim()) {
      setMessage('メールアドレスを入力してください。');
      return;
    }
    setBusy(true);
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });
      if (error) {
        throw error;
      }
      setMessage('ログイン用メールを送信しました。メール内のリンクを開いて戻ってください。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ログインメールを送れませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const createRoom = async () => {
    setBusy(true);
    try {
      const payload = await createOthelloRoom(displayName.trim() || 'プレイヤー');
      setActiveRoomId(payload.roomId);
      setOnlineState(payload.state);
      setJoinRoomId(payload.roomId);
      router.setParams({ room: payload.roomId });
      setMessage('ルームを作成しました。招待リンクを相手へ送ってください。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ルームを作成できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const joinRoom = async () => {
    if (!joinRoomId.trim()) {
      setMessage('ルームIDを入力してください。');
      return;
    }
    setBusy(true);
    try {
      const payload = await joinOthelloRoom(
        joinRoomId.trim(),
        displayName.trim() || 'プレイヤー',
      );
      setActiveRoomId(payload.roomId);
      setOnlineState(payload.state);
      router.setParams({ room: payload.roomId });
      setMessage('ルームへ参加しました。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ルームへ参加できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const performAction = async (
    type: OthelloAction['type'],
    position?: Position,
  ) => {
    if (!state || !canAct || busy) {
      return;
    }

    const action: OthelloAction =
      type === 'place_disc'
        ? {
            type,
            gameId: 'othello',
            sessionId: state.sessionId,
            actionId: createActionId(),
            playerId:
              mode === 'demo'
                ? state.players[state.currentTurn].id
                : session!.user.id,
            stateVersion: state.stateVersion,
            payload: position!,
          }
        : {
            type,
            gameId: 'othello',
            sessionId: state.sessionId,
            actionId: createActionId(),
            playerId:
              mode === 'demo'
                ? state.players[state.currentTurn].id
                : session!.user.id,
            stateVersion: state.stateVersion,
            payload: {},
          };

    setBusy(true);
    try {
      if (mode === 'demo') {
        setDemoState((current) => applyOthelloAction(current, action));
      } else {
        const payload = await submitOthelloAction(state.sessionId, action);
        setOnlineState(payload.state);
      }
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '手を送信できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const copyInvite = async () => {
    if (!activeRoomId) {
      return;
    }
    try {
      const copied = await shareInvite(activeRoomId);
      setMessage(
        copied
          ? '招待リンクをクリップボードへコピーしました。'
          : `このURLを共有してください: ${getInviteUrl(activeRoomId)}`,
      );
    } catch {
      setMessage(`招待リンク: ${getInviteUrl(activeRoomId)}`);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>ONLINE BOARDGAME PLATFORM</Text>
          <Text style={styles.title}>オセロ Web検証版</Text>
          <Text style={styles.subtitle}>
            共通ゲームエンジンを使う、ローカル検証とSupabaseオンライン対戦の最初の縦切りです。
          </Text>
        </View>

        <View style={styles.modeRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode('demo');
              setMessage('ローカル検証モードです。1つのブラウザで黒・白を交互に操作できます。');
            }}
            style={[styles.modeButton, mode === 'demo' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeText, mode === 'demo' && styles.modeTextActive]}>
              ローカル検証
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={switchToOnline}
            style={[styles.modeButton, mode === 'online' && styles.modeButtonActive]}
          >
            <Text style={[styles.modeText, mode === 'online' && styles.modeTextActive]}>
              オンライン対戦
            </Text>
          </Pressable>
        </View>

        {mode === 'online' && !session ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>オンライン対戦にログイン</Text>
            <Text style={styles.helpText}>
              SupabaseのメールOTPでログインします。初回はセットアップガイドに従ってRedirect URLを設定してください。
            </Text>
            <TextInput
              accessibilityLabel="表示名"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="表示名"
              style={styles.input}
            />
            <TextInput
              accessibilityLabel="メールアドレス"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={sendMagicLink}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>ログインリンクを送る</Text>
            </Pressable>
          </View>
        ) : null}

        {mode === 'online' && session && !onlineState ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>対戦ルーム</Text>
            <Text style={styles.helpText}>ログイン中: {session.user.email ?? session.user.id}</Text>
            <TextInput
              accessibilityLabel="表示名"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="表示名"
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={createRoom}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>黒番としてルームを作る</Text>
            </Pressable>
            <Text style={styles.or}>または</Text>
            <TextInput
              accessibilityLabel="ルームID"
              value={joinRoomId}
              onChangeText={setJoinRoomId}
              placeholder="招待されたルームID"
              autoCapitalize="none"
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={joinRoom}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>白番として参加する</Text>
            </Pressable>
          </View>
        ) : null}

        {state ? (
          <View style={styles.gameLayout}>
            <View style={styles.boardPanel}>
              <View style={styles.statusRow}>
                <View>
                  <Text style={styles.statusLabel}>
                    {state.phase === 'finished'
                      ? winnerLabel(state)
                      : state.phase === 'waiting'
                        ? '白番の参加待ちです'
                        : `${colorLabel(state.currentTurn)}の手番です`}
                  </Text>
                  <Text style={styles.statusDetail}>
                    {state.phase === 'playing'
                      ? `${activePlayer?.name ?? colorLabel(state.currentTurn)}が操作します`
                      : '状態バージョン: ' + state.stateVersion}
                  </Text>
                </View>
                <View style={styles.score}>
                  <Text style={styles.scoreBlack}>● {score.black}</Text>
                  <Text style={styles.scoreWhite}>○ {score.white}</Text>
                </View>
              </View>

              <View accessibilityLabel="オセロ盤面" style={styles.board}>
                {state.board.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.boardRow}>
                    {row.map((cell, colIndex) => {
                      const isLegal = legalMoveKeys.has(`${rowIndex}-${colIndex}`);
                      return (
                        <Pressable
                          key={colIndex}
                          accessibilityRole="button"
                          accessibilityLabel={
                            cell === 'empty'
                              ? `${rowIndex + 1}行${colIndex + 1}列${isLegal ? '。置けます' : ''}`
                              : `${rowIndex + 1}行${colIndex + 1}列、${colorLabel(cell)}の石`
                          }
                          disabled={!isLegal || !canAct || busy}
                          onPress={() => void performAction('place_disc', { row: rowIndex, col: colIndex })}
                          style={[styles.cell, isLegal && canAct && styles.legalCell]}
                        >
                          {cell !== 'empty' ? (
                            <View style={[styles.disc, cell === 'black' ? styles.blackDisc : styles.whiteDisc]} />
                          ) : isLegal && canAct ? (
                            <View style={styles.legalDot} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View style={styles.actionRow}>
                {state.phase === 'playing' && legalMoves.length === 0 && canAct ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void performAction('pass')}
                    style={styles.primaryButton}
                  >
                    <Text style={styles.primaryButtonText}>パスする</Text>
                  </Pressable>
                ) : null}
                {state.phase === 'playing' && canAct ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={() => void performAction('resign')}
                    style={styles.dangerButton}
                  >
                    <Text style={styles.dangerButtonText}>投了</Text>
                  </Pressable>
                ) : null}
                {mode === 'demo' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setDemoState(createDemoState());
                      setMessage('新しいローカル対局を開始しました。');
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>最初からやり直す</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.sidePanel}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>プレイヤー</Text>
                <Text style={styles.playerLine}>● {state.players.black.name}</Text>
                <Text style={styles.playerLine}>○ {state.players.white.name}</Text>
              </View>
              {mode === 'online' && activeRoomId ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>招待</Text>
                  <Text selectable style={styles.roomId}>{activeRoomId}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={copyInvite}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>招待リンクをコピー</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>ローカル検証モード</Text>
                  <Text style={styles.helpText}>
                    1つのブラウザで黒・白を交互に操作できます。Supabaseを設定すると、別ブラウザとのオンライン対戦に切り替えられます。
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {message ? (
          <View accessibilityLiveRegion="polite" style={styles.message}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f7f1' },
  page: { width: '100%', maxWidth: 1120, alignSelf: 'center', padding: 20, gap: 16 },
  hero: { gap: 6, paddingVertical: 14 },
  kicker: { color: '#57705b', fontSize: 12, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: '#14221a', fontSize: 34, fontWeight: '800' },
  subtitle: { color: '#4a5c50', fontSize: 15, lineHeight: 23, maxWidth: 700 },
  modeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  modeButton: { borderColor: '#a9b9aa', borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  modeButtonActive: { backgroundColor: '#204f38', borderColor: '#204f38' },
  modeText: { color: '#204f38', fontWeight: '700' },
  modeTextActive: { color: '#ffffff' },
  card: { backgroundColor: '#ffffff', borderColor: '#dbe5dc', borderRadius: 14, borderWidth: 1, gap: 12, padding: 16 },
  cardTitle: { color: '#1a2e21', fontSize: 18, fontWeight: '800' },
  helpText: { color: '#526358', fontSize: 14, lineHeight: 21 },
  input: { backgroundColor: '#f8faf8', borderColor: '#b7c6b9', borderRadius: 9, borderWidth: 1, color: '#16251b', minHeight: 44, paddingHorizontal: 12 },
  primaryButton: { alignItems: 'center', backgroundColor: '#286344', borderRadius: 9, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  primaryButtonText: { color: '#ffffff', fontWeight: '800' },
  secondaryButton: { alignItems: 'center', backgroundColor: '#edf4ed', borderColor: '#8da892', borderRadius: 9, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  secondaryButtonText: { color: '#224c31', fontWeight: '800' },
  dangerButton: { alignItems: 'center', backgroundColor: '#fff0ed', borderColor: '#cc765e', borderRadius: 9, borderWidth: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  dangerButtonText: { color: '#9c311c', fontWeight: '800' },
  or: { color: '#6b796d', textAlign: 'center' },
  gameLayout: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' },
  boardPanel: { backgroundColor: '#ffffff', borderColor: '#dbe5dc', borderRadius: 14, borderWidth: 1, flexGrow: 1, gap: 16, maxWidth: 700, minWidth: 300, padding: 16 },
  sidePanel: { flexBasis: 280, flexGrow: 1, gap: 16, minWidth: 250 },
  statusRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  statusLabel: { color: '#15261b', fontSize: 18, fontWeight: '800' },
  statusDetail: { color: '#607064', fontSize: 13, marginTop: 3 },
  score: { alignItems: 'flex-end', gap: 2 },
  scoreBlack: { color: '#19221b', fontSize: 16, fontWeight: '800' },
  scoreWhite: { color: '#526156', fontSize: 16, fontWeight: '800' },
  board: { alignSelf: 'center', aspectRatio: 1, backgroundColor: '#1b5b35', borderColor: '#143e27', borderRadius: 4, borderWidth: 4, maxWidth: 620, width: '100%' },
  boardRow: { flex: 1, flexDirection: 'row' },
  cell: { alignItems: 'center', borderColor: 'rgba(230,255,230,0.52)', borderRightWidth: 1, borderBottomWidth: 1, flex: 1, justifyContent: 'center', minWidth: 0 },
  legalCell: { backgroundColor: 'rgba(232,255,219,0.12)' },
  disc: { aspectRatio: 1, borderRadius: 999, elevation: 2, shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 2, width: '72%' },
  blackDisc: { backgroundColor: '#1d201d', borderColor: '#000000', borderWidth: 1 },
  whiteDisc: { backgroundColor: '#f9fff8', borderColor: '#cbd7cb', borderWidth: 1 },
  legalDot: { backgroundColor: '#d9f49a', borderRadius: 999, height: '18%', opacity: 0.85, width: '18%' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  playerLine: { color: '#33463a', fontSize: 15, lineHeight: 24 },
  roomId: { color: '#375241', fontFamily: 'monospace', fontSize: 12 },
  message: { backgroundColor: '#eaf4e9', borderColor: '#a9c6ab', borderRadius: 10, borderWidth: 1, padding: 12 },
  messageText: { color: '#244b31', lineHeight: 20 },
});
