# オンラインボードゲームプラットフォーム

## 要件定義書 v0.3（プラットフォーム基盤とゲーム分離版）

| 項目 | 内容 |
| --- | --- |
| 文書バージョン | 0.3 |
| 作成日 | 2026-08-25 |
| 対象 | Android / iOS / Web の共通プラットフォーム基盤 |
| 想定技術 | Expo / React Native / React Native Web / TypeScript / Supabase / Edge Functions / EAS |
| 目的 | ゲーム追加可能なプラットフォーム基盤を定義し、最初のMVPとしてオセロを実装するための要件を整理する。 |

---

## 0. 結論

本プラットフォームは、ゲームそのものを1つのアプリとして実装するのではなく、**共通基盤とゲーム固有モジュールを分離した構成**を目指す。最初のMVPではオセロを実装し、ゲーム追加のための抽象化が成立するかを検証する。

この要件定義書では、プラットフォーム基盤に関する要件を中心に定義する。個別ゲームのルールや検証ロジックは、別文書のゲーム仕様書に記載する。

### 0.1 基本方針

- プラットフォーム基盤とゲーム固有ロジックを分離する
- ルールや勝敗判定はUIではなくサーバー／ゲームエンジンで決定する
- クライアントはゲームの入力要求と画面表示のみを担当する
- Web、Android、iOS は同一のルーム／ゲーム契約を使う
- 最初のMVPではオセロを対象とし、後続ゲームは抽象化により追加する

### 0.2 優先度

| 優先度 | 意味 |
| --- | --- |
| Must | MVPで必須 |
| Should | MVPで可能なら実施 |
| Could | 後続改善 |

---

## 1. 対象範囲と分離方針

### 1.1 プラットフォーム基盤の対象

- 認証
- ルーム作成
- 参加・退出
- ゲーム選択
- 招待URL
- Realtime通信
- 再接続
- 状態同期
- 共通画面
- 複数ゲームへの拡張基盤

### 1.2 ゲーム固有の対象

- オセロの初期盤面
- 合法手判定
- 石のひっくり返し判定
- パス判定
- 終局判定
- 勝敗判定
- UI表示用の投影ルール

### 1.3 設計上の境界

- プラットフォーム: ルーム / 対戦管理 / 画面遷移 / 通信 / 認証
- ゲームエンジン: オセロのルール / 状態遷移 / 合法手判定
- UI: 入力受け取り、描画、レスポンシブ表示
- Server Authority: バリデーション、状態更新、履歴管理

---

## 2. プラットフォーム基盤要件

### 2.1 アカウントと招待

| ID | 要件 | 優先度 |
| --- | --- | --- |
| P-01 | メールOTPまたはMagic Linkを利用できる | Must |
| P-02 | Webとネイティブで同一の招待URL契約を利用できる | Must |
| P-03 | 招待URLは推測困難なトークンと有効期限を持つ | Must |
| P-04 | ルーム参加者以外には非公開情報を見せない | Must |
| P-05 | ログアウトとアカウント削除を全クライアントから実行できる | Must |

### 2.2 ゲーム選択とルーム

| ID | 要件 | 優先度 |
| --- | --- | --- |
| P-10 | ユーザーはゲーム一覧からゲームを選べる | Must |
| P-11 | ユーザーは人数上限を指定してルームを作成できる | Must |
| P-12 | ユーザーは招待URLまたは募集で参加できる | Must |
| P-13 | 必要人数に達した後、開始条件を満たした場合にゲームを開始できる | Must |
| P-14 | ルーム参加者一覧と接続状態を表示できる | Must |
| P-15 | 参加者が退出した際に状態を再計算できる | Must |

### 2.3 対局進行

| ID | 要件 | 優先度 |
| --- | --- | --- |
| P-20 | クライアントは`GameAction`のみを送信する | Must |
| P-21 | サーバーは参加資格、手番、ゲーム状態、action_id、state_versionを検証する | Must |
| P-22 | 不正なアクションは拒否し、理由コードと最新状態を返す | Must |
| P-23 | 各クライアントはRealtime通知または再接続時に最新状態を取得する | Must |
| P-24 | 盤面や非公開情報は役割に応じて投影する | Must |
| P-25 | 途中離脱後もサーバー確定状態に戻って対局を再開できる | Must |

### 2.4 接続・再接続

| ID | 要件 | 優先度 |
| --- | --- | --- |
| P-30 | アプリ／ブラウザの接続状態を検知して表示する | Must |
| P-31 | 再接続時は最後の確定状態から再同期する | Must |
| P-32 | `action_id` を付与し、重複送信しても二重適用しない | Must |
| P-33 | バックグラウンド、ネットワーク切断、リロード後でも対局を再現できる | Must |

---

## 3. 共通データ契約

### 3.1 代表的な共通データ

```ts
type GameId = 'othello' | string;

type GameAction = {
  type: string;
  gameId: GameId;
  sessionId: string;
  actionId: string;
  playerId: string;
  stateVersion: number;
  payload: Record<string, unknown>;
};

type GameState = {
  gameId: GameId;
  sessionId: string;
  stateVersion: number;
  phase: 'waiting' | 'playing' | 'finished';
  currentTurn: string | null;
  players: Array<{ id: string; name: string; role?: string; connected: boolean }>;
  board: unknown;
  winner: string | null;
  metadata: Record<string, unknown>;
};
```

### 3.2 共通ルール

- `stateVersion` は常に増加する
- `actionId` は一意で、重複送信を識別できる
- `board` はゲーム固有モジュールで定義される
- 1つのゲームは `gameId` で識別する
- クライアントが生の状態を書き換えてはいけない

---

## 4. プラットフォームのサーバー権威設計

1. クライアントは入力を `GameAction` として送信する
2. Edge Function / RPC が JWT と room membership を検証する
3. ゲーム固有の検証ロジックで合法手か確認する
4. 新しい状態を保存し、`stateVersion` を更新する
5. 参加者に対して private Realtime 通知を送る
6. クライアントは通知を受けて必要なら再取得する

### 4.1 禁止事項

- クライアントから `game_sessions` を直接更新しない
- 盤面状態を生のままそのまま受信してはならない
- Realtime の broadcast を無条件で許可しない
- 同一 `actionId` を複数適用しない

---

## 5. ゲーム固有要件（MVP対象: オセロ）

MVPの最初のゲームはオセロとする。詳細は別文書の「オセロゲーム仕様書」を参照する。

- 2人対戦固定
- 8x8 の盤面
- 黒/白の2色
- 初期配置は中央4マス
- 合法手判定は横縦斜め方向を全て確認する
- ひっくり返せる石を決める
- パス時はターンが移る
- 盤面が埋まるか両者が置けない場合に終局
- 勝敗は石の数で決定する

---

## 6. 非機能要件

| ID | 要件 | 優先度 |
| --- | --- | --- |
| NFR-01 | 通信は HTTPS / WSS を使用する | Must |
| NFR-02 | 認証・認可は Supabase Auth と RLS を基本とする | Must |
| NFR-03 | Realtime コミュニケーションは private channel を利用する | Must |
| NFR-04 | 状態破損、重複適用、秘匿情報漏えいを防ぐ | Must |
| NFR-05 | ゲーム検証は決定的で再現可能にする | Must |
| NFR-06 | Web版はキーボード・スクリーンリーダー対応を保つ | Must |
| NFR-07 | 主要画面は 320px からデスクトップまで崩れない | Must |
| NFR-08 | 監視項目として失敗率・同期失敗・拒否率を記録する | Should |

---

## 7. テストと受入基準

### 7.1 プラットフォーム基盤テスト

- ログイン成功
- 招待URLの適切な遷移
- ルーム参加
- 2人同一ゲーム開始
- Realtime同期
- 再接続後の復元
- action_id 重複送信時の防止

### 7.2 オセロテスト

- 初期状態が正しい
- 合法手が正しく判定される
- 無効な手が拒否される
- 石が正しく反転する
- パスが正しく扱われる
- 終局時に勝敗が計算される

---

## 8. 変更管理と将来拡張

- 個別ゲームの仕様は、ゲーム別の仕様書として管理する
- ゲーム追加時にプラットフォーム仕様の変更が最小になることを目指す
- 新しいゲーム追加後に、共通契約が破壊的変更にならないようにする
- 2本目のゲーム追加が可能なことを、MVPの成功条件の一つとする

---

## 9. まとめ

本要件定義書は、オンラインボードゲームプラットフォームの共通部分を対象とする。特に重要なのは、プラットフォーム基盤とゲーム固有仕様を分離し、最初のMVPとしてオセロを実装しつつ、将来のゲーム追加を見据えて設計することである。

次の実装段階では、オセロ専用のゲーム仕様書を具体化し、ゲームエンジン／サーバー検証／UIをそれぞれの責務に沿って実装する。

### 8.2 MVP受入基準

| ID | 受入基準 |
| --- | --- |
| AC-01 | Androidアプリ、iOSアプリ、ChromeまたはSafariの各クライアントから同一ユーザーがログインできる。 |
| AC-02 | Android・iOS・Webの3人が同一ルームへ参加し、同一のゲーム状態を見ながら最後まで対戦できる。 |
| AC-03 | Web招待URLを新しいブラウザセッションで開き、認証後に正しいルームへ参加できる。 |
| AC-04 | 無効な手番、古い状態バージョン、重複した`action_id`、非参加者のアクションがサーバーで拒否される。 |
| AC-05 | いずれかのクライアントを一時的に切断またはバックグラウンド化し、復帰後に確定状態へ同期できる。 |
| AC-06 | Webでタップ／クリックだけで全ての必須操作ができ、キーボードだけでも主要な操作ができる。 |
| AC-07 | Web出力、Androidビルド、iOSビルド、lint、typecheck、ゲームエンジンのテストがCIで成功する。 |
| AC-08 | RLSとprivate Realtimeにより、非参加者が別ルームの状態・通知・秘匿情報を取得できない。 |

## 9. CI/CDとリリース

### 9.1 Pull Request

```text
install
├─ lint / typecheck
├─ game-engine unit test / simulation
├─ schema validation
├─ Supabase migration + RLS integration test
├─ expo export --platform web
├─ Web E2E
└─ cross-platform dependency check
```

UI、Expo設定、Native dependency、Platform Adapterの変更がある場合は、PRまたはmainでAndroid・iOSのDevelopment / Preview Buildを実行する。WebはPRごとにプレビューURLを作成し、招待・対局の基本フローを確認可能にする。

### 9.2 環境分離

| 環境 | 用途 | Web | Native |
| --- | --- | --- | --- |
| Local | 開発・自動テスト | localhostのWeb export／開発サーバー | Development Build |
| Staging | 結合・混在E2E | 認証リダイレクトを登録したプレビュー環境 | Preview Build |
| Production | 一般公開 | 独自ドメインの静的配信 | Store配布ビルド |

Local / Staging / ProductionでSupabaseプロジェクト、認証リダイレクトURL、Web Origin、秘密情報を分離する。匿名キーを含むクライアント設定と、サーバー専用キーを混在させない。

## 10. 実装フェーズ

| Phase | 目的 | 完了条件 |
| --- | --- | --- |
| 0. Foundation | Universal Clientと環境を成立させる | Android/iOS Development Build、Web export、Supabase Local、共通認証画面が動く。 |
| 1. Vertical Slice | 極小ゲームで3クライアント対戦を通す | 招待、ルーム、サーバー検証、同期、結果表示をAndroid × iOS × Webで完走する。 |
| 2. Reliability | 復帰・権限・秘匿性を固める | 再接続、競合、RLS、private Realtime、監査ログを検証する。 |
| 3. Game Platform | 2本目のゲームを追加する | 共通エンジン・定義だけでゲームを追加し、クライアント固有実装を増やさない。 |
| 4. Release | 公開運用に備える | Web本番配信、Storeビルド、監視、削除導線、運用手順を整備する。 |

最初に作るゲームは、ターン制で情報秘匿が少なく、操作数の少ないものを選ぶ。ゲームを作り込む前に、Android・iOS・Webの混在ルームで縦の経路を通すことを最優先とする。

## 11. Definition of Done

機能変更は、以下をすべて満たして完了とする。

- 共通層にWeb専用またはOS専用の依存が漏れていない。
- Game Engineのテスト、lint、typecheck、schema validationが成功している。
- サーバー状態を直接更新する経路や、検証を回避できるRLSポリシーがない。
- Web export、Android、iOSへの影響を確認している。
- UI変更ではモバイル幅・デスクトップ幅、タッチ・クリック、キーボード操作を確認している。
- ルームやゲーム同期に関わる変更では、少なくとも1つの混在対戦テストを追加または実行している。
- 新しいNative／Web依存は3プラットフォームの対応状況、ライセンス、サイズ、セキュリティを確認している。
- 秘密情報、アクセストークン、招待トークン、秘匿ゲーム状態をログ・コミット・エラー通知へ含めていない。
- 必要な設計資料、環境変数の説明、テスト手順を更新している。

## 12. 後続の設計資料

本書の次に、以下を作成する。

1. システム基本設計書：API境界、Realtime通知、認証、環境構成、責務分割
2. DB・RLS設計書：ER図、状態投影、アクションの冪等性、保持期間、監査方針
3. Game Engine / Game Definition仕様書：状態、Action、Reducer、乱数、秘匿情報、バージョニング
4. Universal UI設計書：ルーティング、レスポンシブ盤面、入力・アクセシビリティ、Web固有UI
5. 初期リポジトリ設計書：workspace、Expo設定、EAS、Web配信、CI、テストコマンド

## 13. 参照方針

技術選定の前提は、Expo RouterがAndroid・iOS・Webで同じルーティングを扱い、ExpoがWebの静的出力をサポートすることである。また、Supabase Realtimeはprivate channelとRLSによる認可を前提に利用する。SDK、ブラウザ対応、ストアポリシー、認証プロバイダーの要件は変わり得るため、実装開始時および本番公開前に公式資料の最新版を再確認する。

- [Expo Router: Universal React Native applications](https://docs.expo.dev/router/introduction/)
- [Expo: Develop websites with Expo](https://docs.expo.dev/workflow/web/)
- [Expo: Publish your web app](https://docs.expo.dev/deploy/web/)
- [Supabase: Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase: Subscribing to Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
