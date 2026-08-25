# オンラインボードゲームプラットフォーム

## 要件定義書 v0.2（クロスプラットフォーム再構成）

| 項目 | 内容 |
| --- | --- |
| 文書バージョン | 0.2（再構成） |
| 作成日 | 2026-08-25 |
| 対象 | Android ネイティブアプリ、iOS ネイティブアプリ、PC・モバイルのWebブラウザ |
| 想定技術 | Expo / React Native / React Native Web / Expo Router / TypeScript / Supabase / GitHub / EAS |
| 文書目的 | 1つのゲーム基盤で、Android・iOS・Web間のオンライン対戦を成立させるための要件と構成を定義する。 |

## 0. 結論と設計方針

本プラットフォームは、Android・iOS・Webを別製品として実装しない。Expoを基盤とした**ユニバーサルクライアント**を1つ持ち、React Native Webによって同じ画面・ゲームロジック・通信契約をブラウザでも利用する。

Webは管理画面や閲覧専用ではなく、ネイティブアプリと同じルームへ参加し、同じゲームを最後まで対戦できる正式なクライアントとする。例えば、Android・iOS・PCブラウザの3人が1つのルームで対戦できなければならない。

ゲームの正しい状態はサーバーだけが確定する。クライアントはゲーム操作を要求し、サーバーが参加資格、手番、行動の妥当性、状態バージョンを検証してから状態を更新する。Realtime通信は画面更新を速める通知経路であり、正しいゲーム状態の唯一の根拠にはしない。

### 0.1 設計原則

- クライアント、ゲームエンジン、通信契約はAndroid・iOS・Webで共通化する。
- OS／ブラウザ固有の機能はPlatform Adapterの内側へ隔離する。
- ルール、勝敗判定、乱数の扱い、状態遷移、権限判定をUIへ置かない。
- 全クライアントが同じゲームセッションID、状態バージョン、アクション形式を使用する。
- マウス、キーボード、タッチのいずれでも主要なゲーム操作を実行できるようにする。
- Web版はインストールを前提とせず、共有URLから参加できるようにする。PWA化はMVPの必須条件にしない。

### 0.2 優先度

| 優先度 | 意味 |
| --- | --- |
| Must | MVPのクロスプラットフォーム対戦に必須 |
| Should | MVPで可能な限り満たす |
| Could | MVP完了後に追加する |

## 1. 対象範囲

### 1.1 MVPで実現すること

- 2〜4人が、Androidアプリ、iOSアプリ、またはWebブラウザから同一ルームに参加できる。
- 異なるプラットフォームの参加者を含むゲームを、開始から終了まで進行できる。
- ユーザー認証、ゲーム選択、募集・招待、ルーム参加、ゲーム進行、結果表示をすべてのクライアントで利用できる。
- 共有URLからWeb版の該当ルームまたは招待画面を開ける。ネイティブアプリがインストール済みの場合はUniversal Link / App Linkによる起動を許容する。
- 通信切断、アプリのバックグラウンド化、ブラウザタブの休止後に、権威ある状態を再取得して対局へ復帰できる。
- 少なくとも2種類のゲームを、共通のゲームエンジンとゲーム定義を利用して提供する。

### 1.2 MVPの対象外

- オフライン対戦、Bluetooth／LAN対戦、完全なオフラインゲーム。
- Web版のネイティブアプリと同等のPush通知。
- App Store / Google Play Games / Game Centerとの高度な連携。
- ユーザー制作ゲームの即時公開、任意コードの配信、課金、ランキング、観戦、ボイスチャット。
- Internet Explorerを含むサポート終了ブラウザへの対応。

## 2. 成功条件

| ID | 指標 | MVPの達成条件 |
| --- | --- | --- |
| KPI-01 | 混在対戦 | Android、iOS、Webのうち任意の2〜4クライアントが同一ルームで1ゲーム完了できる。 |
| KPI-02 | 共通性 | ゲームルール、アクション形式、状態同期プロトコルをクライアント別に複製しない。 |
| KPI-03 | 参加容易性 | Webの招待URLを開いて認証・参加・対戦開始まで到達できる。 |
| KPI-04 | 復帰性 | 一時切断後、古いローカル状態を採用せずサーバーの状態へ同期して復帰できる。 |
| KPI-05 | 追加性 | 2本目のゲームを、認証・ルーム・Realtime・各プラットフォーム用画面を作り直さず追加できる。 |

## 3. サポート対象と利用体験

### 3.1 サポート対象

| 区分 | Mustの対象 | 補足 |
| --- | --- | --- |
| Androidアプリ | Android 10以降 | Expo Development Buildおよび配布ビルドで検証する。 |
| iOSアプリ | iOS 16以降 | 実機またはSimulatorで検証する。 |
| モバイルWeb | Android Chrome、iOS Safariの現行版と直前の主要版 | アプリ未導入でも対戦できる。 |
| デスクトップWeb | Chrome、Safari、Edgeの現行版と直前の主要版 | マウス・キーボードによる操作を含む。 |

サポートOS・ブラウザの最低バージョンは、リリースごとに利用状況とExpoのサポート状況を確認して見直す。Webの互換性はUser-Agentによる無条件な拒否ではなく、必要な機能の検出と分かりやすい案内を基本とする。

### 3.2 共通の画面・操作要件

| ID | 要件 | 優先度 |
| --- | --- | --- |
| UX-01 | 認証、ロビー、ゲーム一覧、ルーム、対局、結果の情報構造と用語を3クライアントで共通にする。 | Must |
| UX-02 | 画面幅に応じて、モバイルでは縦長・タッチ中心、デスクトップでは盤面と情報パネルを並列表示できる。 | Must |
| UX-03 | 盤面上の操作には、タップ／クリックと同等の代替操作を用意する。ホバーだけ、ドラッグだけに依存しない。 | Must |
| UX-04 | Webではキーボード操作、フォーカス順、可視フォーカス、読み上げ用ラベルを提供する。 | Must |
| UX-05 | 盤面・カード・手札は画面密度に依存しない論理座標とレイアウト規則で描画する。 | Must |
| UX-06 | 小画面で横幅が不足する場合は、情報パネルの折り畳み、盤面の縮小、横向き案内の順に対応する。重要な操作を画面外へ隠さない。 | Should |
| UX-07 | 入力中・送信中・再同期中・相手待ち・終了の状態を明示する。 | Must |

## 4. 機能要件

### 4.1 アカウントと招待

| ID | 要件 | 優先度 |
| --- | --- | --- |
| FR-01 | メールOTPまたはMagic Linkを、Android、iOS、Webで利用できる。 | Must |
| FR-02 | 認証完了後、招待URLが示すルームへ安全に復帰する。WebとネイティブのリダイレクトURLを環境別に登録する。 | Must |
| FR-03 | 招待URLは推測困難なトークンを用い、参加資格・有効期限・使用回数をサーバーで判定する。 | Must |
| FR-04 | ルーム参加者以外は、対局の非公開情報およびRealtimeチャンネルを閲覧できない。 | Must |
| FR-05 | アカウント削除とログアウトをすべてのクライアントから実行できる。 | Must |

### 4.2 ルームとゲーム進行

| ID | 要件 | 優先度 |
| --- | --- | --- |
| FR-10 | ユーザーはゲームを選び、人数上限を指定したルームを作成できる。 | Must |
| FR-11 | ユーザーは公開募集または招待URLでルームへ参加・退出できる。 | Must |
| FR-12 | 参加者が必要人数を満たした後、ルーム所有者または定義された条件で対局を開始できる。 | Must |
| FR-13 | クライアントは`GameAction`を送信するが、ゲーム状態を直接更新できない。 | Must |
| FR-14 | サーバーは認証、ルーム所属、手番、ゲームバージョン、アクション形式、状態バージョンを検証してから状態を更新する。 | Must |
| FR-15 | 不正または競合したアクションは拒否し、クライアントへ最新状態と理由コードを返す。 | Must |
| FR-16 | 各クライアントはRealtime通知受信時および復帰時に、必要に応じて最新スナップショットを取得して表示を更新する。 | Must |
| FR-17 | 秘匿情報は参加者の役割に応じて投影する。クライアントへ他プレイヤーの手札・未公開情報を送信しない。 | Must |

### 4.3 接続・復帰

| ID | 要件 | 優先度 |
| --- | --- | --- |
| FR-20 | アプリのforeground / background / resume、ブラウザのonline / offline / visibilitychangeを検知して接続状態を表示する。 | Must |
| FR-21 | 再接続時は、最後に受け取った状態バージョンを基に差分またはスナップショットを取得する。 | Must |
| FR-22 | アクション送信にはクライアント生成の一意な`action_id`を付与し、再送しても二重適用されない。 | Must |
| FR-23 | タブ休止・ネットワーク変更・アプリ再起動後でも、サーバー確定済みの結果を再現できる。 | Must |

## 5. アーキテクチャ

### 5.1 全体構成

```text
Android App ─┐
iOS App ────┼─ Universal Client（Expo / React Native / Expo Router）
Web Browser ┘                    │
                                 │ HTTPS / WSS
                                 ▼
                     Supabase Auth / PostgreSQL / Realtime
                                 │
                                 ▼
            Edge Function + DB Transaction / RPC（サーバー権威）
                                 │
                                 ▼
                 Game Engine / Game Definitions（TypeScript）
```

Expo RouterはAndroid・iOS・Webで共通のファイルベースルーティングとディープリンクを提供する。Webは`expo export --platform web`で静的成果物として出力し、CDN／静的ホスティングへ配置する。ホスティングはEAS Hostingを第一候補とするが、Web成果物と環境変数の契約を守る限り別の静的ホスティングへ置き換え可能とする。

### 5.2 責務分割

| 層 | 主な責務 | 禁止事項 |
| --- | --- | --- |
| Universal UI | 画面、レスポンシブ表示、入力、表示用状態 | 勝敗や手番の最終判定、直接DB更新 |
| Application | 認証、ルーム、同期、再接続、ユースケース | OS固有APIへの直接依存 |
| Game Engine | 状態遷移、合法手、勝敗、乱数シード、シミュレーション | React、Expo、DOM、Supabaseへの依存 |
| Game Definition | ゲーム固有の初期状態、ルール、表示メタデータ | クライアント別ルール実装 |
| Server Authority | 認可、アクション検証、永続化、競合制御、状態投影 | クライアントの自己申告を無検証で採用 |
| Platform Adapter | secure storage、URL起動、共有、通知、ブラウザ差分 | ゲームルールの実装 |

### 5.3 サーバー権威と同期方式

1. クライアントは、`session_id`、`action_id`、想定`state_version`を含むアクション要求を送る。
2. Edge Functionまたは同等のサーバー入口はJWTを検証し、DBトランザクション／RPC内で参加資格とアクションを検証する。
3. Game Engineで次状態を算出し、スナップショット、アクション履歴、状態バージョンを原子的に更新する。
4. コミット後に、参加者のみが購読できるprivate Realtimeチャンネルへ更新通知を発行する。
5. 通知を受けたクライアントは、バージョン差分または役割別スナップショットを取得して表示する。

`game_actions`、確定済みの状態、結果をクライアントから直接書き込ませない。SupabaseのRLSで読み取り範囲を制限し、Realtime Broadcast / Presenceはprivate channelと認可ポリシーを必須とする。Postgres Changesは小規模な補助用途に限定し、ゲーム進行の主通知には利用しない。

### 5.4 データの最小構成

| データ | 用途 |
| --- | --- |
| `profiles` | 表示名などの公開プロフィール |
| `rooms` / `room_members` | 募集、参加資格、役割、招待状態 |
| `game_catalog` | 提供ゲームと有効なゲーム定義バージョン |
| `game_sessions` | 現在の状態バージョン、フェーズ、終了結果、役割別スナップショット参照 |
| `game_actions` | 冪等なアクション履歴、検証結果、監査用メタデータ |
| `game_snapshots` | 再接続・監査・復旧用の確定状態 |

実際のテーブル定義、RLSポリシー、保持期間、インデックスは後続のDB設計書で定義する。プレイヤー別の秘匿状態は、共通の完全状態をそのまま読み出せる形で保存・配信してはならない。

## 6. クライアント構成

### 6.1 推奨リポジトリ構成

```text
boardgame-platform/
├─ apps/
│  ├─ client/                    # 1つのExpoアプリ: Android / iOS / Web
│  │  ├─ app/                    # Expo Router routes
│  │  └─ src/
│  │     ├─ features/            # auth, lobby, room, game
│  │     ├─ components/          # 共有UI、盤面Renderer
│  │     ├─ services/            # API、Realtime、session
│  │     └─ platform/            # *.native.ts / *.web.ts adapters
│  └─ admin/                     # 任意: 運営専用Web。対戦クライアントとは分離
├─ packages/
│  ├─ game-engine/               # 純粋なTypeScript
│  ├─ game-definitions/          # ゲーム固有定義と表示メタデータ
│  ├─ game-contracts/            # State / Action / API schema
│  ├─ ui/                        # React Native Web互換の共有コンポーネント
│  ├─ platform-contracts/        # Platform Adapter interface
│  └─ config/                    # lint、TypeScript、test共通設定
├─ supabase/
│  ├─ migrations/
│  ├─ functions/
│  └─ seed.sql
├─ tests/
│  ├─ integration/
│  └─ e2e/
├─ docs/
└─ .github/workflows/
```

pnpm workspaceを基本とし、タスク実行はTurborepo等で依存関係に沿ってキャッシュできる構成を推奨する。`apps/client`をAndroid用、iOS用、Web用へ分割してゲーム画面を重複実装してはならない。

### 6.2 Platform Adapter

Platform Adapterは次のようなインターフェースを持ち、実装を`*.web.ts`、`*.native.ts`、必要な場合のみ`*.android.ts`／`*.ios.ts`に分ける。

- セッション保存（ネイティブの安全な保存領域、Webの安全方針に沿った保存領域）
- 外部URL・ディープリンク・招待URLの処理
- 共有機能、クリップボード、通知、権限、ライフサイクル
- Webにおけるキーボード、ポインター、可視性、オンライン状態

新しい依存関係はAndroid・iOS・Webのすべてを確認し、対応しない場合はアダプターの内側で代替実装または機能制限を明示する。ゲームエンジンと共通アプリケーション層から`window`、`document`、`navigator`、ネイティブモジュールを直接参照してはならない。

### 6.3 Web固有の要件

- `web.output`は静的出力を基本とする。対局画面は認証後のクライアントアプリとして動作し、秘密情報を静的HTMLへ埋め込まない。
- 招待・ルーム・対局のURLは直接アクセス、リロード、履歴移動で壊れない。
- CSP、HTTPS、許可済みOrigin、リダイレクトURLを環境ごとに設定する。アクセストークン、招待トークン、秘匿状態をログ・分析基盤・URLクエリに出力しない。
- `target="_blank"`で開く外部リンクには適切な防御を行い、Web固有のXSS対策をリリース条件に含める。
- マウスの右クリック、テキスト選択、ズーム、ブラウザの戻る操作を前提に、ゲームの不正な二重実行や画面崩れを起こさない。

## 7. 非機能要件

| ID | 要件 | 優先度 |
| --- | --- | --- |
| NFR-01 | すべての通信をHTTPS / WSSで行う。 | Must |
| NFR-02 | 認証・認可はSupabase AuthとRLSを基本とし、サーバー側のゲーム検証を併用する。 | Must |
| NFR-03 | Realtimeチャンネルはルーム／セッション単位のprivate channelとし、所属ユーザーだけが購読・発信できる。 | Must |
| NFR-04 | 競合時に状態破損・二重適用・他プレイヤー情報の漏えいを起こさない。 | Must |
| NFR-05 | 状態遷移とアクション検証は決定的で、同じ入力から同じ結果を再現できる。 | Must |
| NFR-06 | Web版はキーボード操作とスクリーンリーダー利用を妨げない。 | Must |
| NFR-07 | 主要画面は320 CSS px相当の幅からデスクトップ幅まで破綻しない。 | Must |
| NFR-08 | 監視ではクライアント種別、同期失敗、アクション拒否、再接続、エラー率を計測する。個人情報とゲームの秘匿情報は記録しない。 | Should |

## 8. テストと受入基準

### 8.1 テスト方針

| 層 | 対象 | 実施内容 |
| --- | --- | --- |
| Unit | Game Engine / Game Definition | 合法手、状態遷移、勝敗、秘匿情報の投影、乱数シード、冪等性 |
| Integration | Supabase / Edge Function / RLS | 認証、参加資格、アクション検証、競合、private Realtime、再接続 |
| Web E2E | Chromium、WebKit | 招待、ログイン、ルーム、対局、リロード、キーボード、レスポンシブ表示 |
| Native E2E | Android、iOS | 招待、ログイン、ルーム、対局、バックグラウンド復帰 |
| 混在E2E | Android × iOS × Web | 同一ルームでの操作反映、離脱・復帰、終了結果の一致 |

Web E2EにはPlaywright、ネイティブE2EにはMaestro等を採用候補とする。特定ツールの採用は初期リポジトリ設計書で確定するが、少なくともブラウザ実機系とネイティブ実機／Simulator系の両方を自動検証対象とする。

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
