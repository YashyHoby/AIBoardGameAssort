# オンラインボードゲームプラットフォーム

## 要件定義書

**MVP / Android・iOSクロスプラットフォーム / AIエージェント開発基盤**

| 項目 | 内容 |
| --- | --- |
| 文書バージョン | 0.2（ドラフト） |
| 作成日 | 2026-08-23 |
| 対象 | Android / iOS対応の2〜4人用オンラインボードゲームプラットフォーム |
| 想定技術 | React Native / Expo / Expo Router / TypeScript / Supabase / GitHub / Codex / EAS |
| 文書目的 | MVPの開発範囲、Android/iOS両対応を維持する設計原則、将来的なボードゲーム量産基盤およびAIエージェント開発基盤の要件を定義する |

# 0. 文書の位置づけ

本書は、スマートフォン上で複数種類のボードゲームをオンライン対戦できるプラットフォームについて、初期開発（MVP）に必要な要件と、将来的に生成AI／Codexを用いてゲームを継続追加するための開発基盤要件を定義する。

本プロジェクトでは、**Android向けアプリを完成させた後にiOSへ移植する方式を採用しない**。初期段階からAndroid / iOSの双方を対象とする単一コードベースとして設計・実装し、MVP開発中も両OSでビルド可能な状態を維持する。

> 本書は「何を満たすべきか」を定める要件定義書であり、画面遷移の全詳細、API仕様、DBの全カラム、Game DSLの文法などは後続の基本設計・詳細設計で定義する。

## 0.1 要件の区分

| 区分 | 意味 |
| --- | --- |
| 確定 | 現時点で実現対象として扱う要件 |
| 推奨 | 現時点の技術・運用上、採用を推奨する設計方針 |
| 未決 | 実装開始前またはMVP検証後に決定する事項 |

## 0.2 優先度

| 優先度 | 意味 |
| --- | --- |
| Must | MVP成立・将来拡張性の確保に必須 |
| Should | MVPで可能な限り実装する |
| Could | MVP後に追加可能 |

# 1. 背景・目的

生成AIを利用すると、ゲームの企画、ルール案、カードやパラメータ、実装、テストコード等を高速に生成できる。一方、ゲームごとに独立したアプリを作成すると、オンライン通信、アカウント、募集、ストア審査、運用を毎回構築する必要があり、量産性が低い。

そこで、共通のモバイルアプリ／バックエンド／ゲームエンジンを持つプラットフォームを先に構築し、新しいゲームを「共通仕様に従ったゲーム定義」として継続的に追加できる状態を目指す。

また、スマートフォン向けサービスとしてAndroid / iOSの双方を対象とし、特定OS固有の実装に依存して後から移植が困難になることを防ぐ。

## 1.1 プロダクト目標

- 2〜4人がインターネット越しにスマートフォンからボードゲームを遊べる。
- Android / iOSの双方で利用できる。
- 1つのアプリ内で複数のボードゲームを選択して遊べる。
- ユーザーがアプリ内で一緒に遊ぶ相手を募集できる。
- 新しいゲームを既存の共通基盤へ低コストで追加できる。
- ゲーム固有ロジックをOSやUIから分離し、自動テスト・シミュレーションできる。
- 将来的にCodex等のAIエージェントが、ゲーム生成・実装・テスト・PR作成まで一貫して行える。

## 1.2 成功指標（MVP）

| ID | 指標 | 目標 |
| --- | --- | --- |
| KPI-01 | オンライン対戦成立 | 2〜4人が同一ルームへ参加し、最後まで1ゲーム完了できる |
| KPI-02 | クロスプラットフォーム | Android / iOSの双方で主要MVPフローが動作する |
| KPI-03 | 複数ゲーム対応 | 同一アプリ上で最低2種類のゲームが共通基盤を利用して動作する |
| KPI-04 | ゲーム追加性 | 既存の認証・募集・ルーム機能を変更せずに3本目を追加できる |
| KPI-05 | 再現可能な開発環境 | Git clone後、文書化されたコマンドでアプリ・ローカルSupabase・テストを起動できる |
| KPI-06 | Agent開発 | Codexがリポジトリの規約に従って変更・テスト・差分提示を行える |
| KPI-07 | OS非依存性 | Game Engine / Game LogicにAndroid/iOS固有APIへの直接依存がない |

# 2. 対象範囲

## 2.1 MVPに含める範囲

- React Native / ExpoによるAndroid / iOS共通モバイルアプリ。
- Android / iOS双方のDevelopment Build。
- Android / iOS双方での主要フロー動作確認。
- ユーザー認証・プロフィールの最小機能。
- ゲーム一覧・ゲーム詳細・ルール表示。
- 募集掲示板、募集への参加、対戦ルーム。
- 2〜4人のリアルタイム／ターン制オンライン対戦。
- ゲーム状態のサーバー側検証と同期。
- 最低2種類のゲーム。
- 通報・ブロック・最低限のモデレーション導線。
- 管理者向けの最低限の運用機能。
- GitHub中心の開発、CI、自動テスト、Supabase migration管理。
- Android / iOS双方のビルド可否を継続確認するCI/CD。
- Expo Goに依存しないDevelopment Build中心の開発環境。

## 2.2 MVP外（将来候補）

- Android / iOS両ストアでの同日一般公開。
- 課金、サブスクリプション、広告。
- 音声通話、ビデオ通話。
- ランキング、レーティング、トーナメント。
- フレンド／フォローの高度なSNS機能。
- Game Center / Google Play Gamesとの高度な統合。
- AIが完全自動で本番公開する仕組み。
- AI Game Factoryによる大量自動生成・自動バランス調整。

> 公開時期はAndroid / iOSで異なってもよい。ただし、MVP開発中から両OSでビルド・動作確認可能な状態を維持し、「後からiOSへ移植する」状態を作らない。

# 3. 想定ユーザーと主要ユースケース

| ユーザー | 目的 | 主な行動 |
| --- | --- | --- |
| 一般プレイヤー | オンラインで気軽に遊ぶ | ログイン、ゲーム選択、募集検索、参加、対戦、チャット、通報 |
| 募集者／ルームホスト | 一緒に遊ぶ人を集める | 募集作成、参加者確認、開始、ルーム管理 |
| 運営者 | サービスを安全に維持する | ゲーム公開管理、通報確認、ユーザー／投稿対応、障害確認 |
| 開発者／AI Agent | ゲーム・機能を継続追加する | コード変更、migration、テスト、PR、Preview確認 |

# 4. システム全体構成

推奨構成は、モバイルアプリ、Supabaseバックエンド、ゲームエンジン／Game Definition、Platform Adapter、管理Web、GitHub／CI/CDの6領域からなる。

| 領域 | 推奨技術 | 役割 |
| --- | --- | --- |
| Mobile App | React Native + Expo + Expo Router + TypeScript | ゲーム一覧、募集、ルーム、ゲームUI、チャット |
| Backend | Supabase | Auth、PostgreSQL、Realtime、Storage、Edge Functions |
| Game Platform | TypeScript package + Game Definition | ターン、カード、山札、得点、勝敗、公開／非公開情報等の共通処理 |
| Platform Adapter | TypeScript interface + OS別実装 | Push、認証、課金、ストレージ、Deep Link等のOS差分吸収 |
| Admin | Next.js（推奨） | ゲーム公開、通報・ユーザー管理、運用確認 |
| Dev / CI | GitHub + Codex + GitHub Actions + EAS | コード正本、AI開発、自動テスト、Android/iOSビルド・配布 |

## 4.1 論理構成

```text
                         ┌────────────────────┐
                         │   Mobile App       │
                         │ React Native/Expo  │
                         └─────────┬──────────┘
                                   │
                 ┌─────────────────┼─────────────────┐
                 │                 │                 │
          ┌──────▼──────┐   ┌──────▼──────┐   ┌────▼─────┐
          │ Shared UI   │   │ Game Engine │   │ Platform │
          │ / Features  │   │ / Game Logic│   │ Adapter  │
          └──────┬──────┘   └──────┬──────┘   └────┬─────┘
                 │                 │                 │
                 └─────────────────┼─────────────────┘
                                   │
                         ┌─────────▼──────────┐
                         │     Supabase       │
                         │ Auth / DB / RT /   │
                         │ Storage / Function │
                         └────────────────────┘

                       Android       iOS
                          ▲           ▲
                          └──── Expo ─┘
```

## 4.2 リポジトリ構成（推奨）

```text
boardgame-platform/
├─ apps/
│  ├─ mobile/                         # Expo / React Native
│  │  ├─ app/                         # Expo Router routes
│  │  └─ src/
│  │     ├─ components/               # OS共通UI
│  │     ├─ features/                 # auth/lobby/room/game等
│  │     ├─ services/                 # API等の共通サービス
│  │     └─ platform/                 # OS差分のAdapter
│  │        ├─ auth/
│  │        ├─ notification/
│  │        ├─ payment/
│  │        └─ storage/
│  └─ admin/                          # 運営Web
├─ packages/
│  ├─ game-engine/                    # 共通ゲームエンジン
│  ├─ game-schema/                    # Game Definitionの型・検証
│  └─ shared/                         # 共通型・ユーティリティ
├─ games/
│  └─ <game-id>/                      # 各ゲーム定義・素材・テスト
├─ supabase/
│  ├─ migrations/                     # DB変更履歴
│  ├─ functions/                      # Edge Functions
│  ├─ seed.sql                        # 開発用データ
│  └─ config.toml                     # Local構成
├─ tests/                              # 結合/E2E
├─ scripts/                            # 生成・検証・simulation
├─ docs/                               # 設計・運用文書
├─ .github/workflows/                  # CI/CD
├─ app.config.ts / app.json            # Expo設定
├─ eas.json                            # Development/Preview/Production build
└─ AGENTS.md                           # Agent向け開発規約
```

# 5. クロスプラットフォーム設計要件

本章の要件は、Android実装が先行した結果としてiOS移植が困難になることを防ぐための必須要件とする。

| ID | 領域 | 要件 | 優先 |
| --- | --- | --- | --- |
| CP-001 | 単一コードベース | Android / iOSは原則として同一React Native / Expoコードベースから生成する。 | Must |
| CP-002 | Game Logic | ゲームルール、State、Action、勝敗判定、simulationはOS APIへ依存してはならない。 | Must |
| CP-003 | UI | 原則として共通React Nativeコンポーネントを利用する。OS別UIは必要性が明確な場合のみ許可する。 | Must |
| CP-004 | Platform Adapter | OS差が必要な機能はinterfaceを定義し、アプリ／ゲームロジックから実装詳細を隠蔽する。 | Must |
| CP-005 | 依存ライブラリ | 新規ライブラリ導入時にAndroid / iOS双方のサポート状況を確認する。片OSのみの依存は原則禁止する。 | Must |
| CP-006 | Platform file | `.android.ts(x)` / `.ios.ts(x)`はOS差が避けられない箇所に限定する。 | Must |
| CP-007 | Build | 開発期間を通じてAndroid / iOS双方のDevelopment Buildを生成できる状態を維持する。 | Must |
| CP-008 | CI | モバイル変更に対してAndroid / iOS双方のビルド破壊を検出できる。 | Must |
| CP-009 | Expo環境 | Expo Goのみを前提とせず、Development BuildでNative Moduleを含む実環境を確認する。 | Must |
| CP-010 | OSライフサイクル | foreground/background/resume、通信断、アプリ再起動からの復帰を両OSで検証する。 | Should |
| CP-011 | Layout | Safe Area、ノッチ、画面サイズ、Dynamic Type等により主要UIが破綻しない。 | Should |
| CP-012 | 権限 | 通知、写真等の権限要求はOS差分をAdapter内で吸収し、不要な権限を要求しない。 | Must |

## 5.1 共通化の境界

以下は原則としてOS非依存とする。

- Game State
- Game Action
- Reducer / State transition
- 勝敗判定
- ターン管理
- 山札・カード・ダイス等のルール処理
- Supabaseとのドメインレベル通信
- 募集・ルームのビジネスロジック
- Schema validation
- simulation
- 共通UIコンポーネント

以下は必要に応じてPlatform Adapterを介する。

- Push Notification
- Apple / Google等の外部認証
- In-App Purchase
- Secure Storage
- Deep Link / Universal Link / App Link
- OS権限
- Game Center / Google Play Games
- その他Native Module

## 5.2 Platform Adapter原則

ゲームやFeatureからOS判定を直接行うコードの増加を防ぐ。

悪い例：

```ts
if (Platform.OS === 'ios') {
  // Feature内部でiOS固有処理
}
```

推奨：

```ts
export interface NotificationService {
  requestPermission(): Promise<boolean>;
  getPushToken(): Promise<string | null>;
}
```

OS差分は`platform/notification/`等に閉じ込める。

# 6. 機能要件

| ID | 機能 | 要件 | 優先 |
| --- | --- | --- | --- |
| FR-001 | アカウント | ユーザーが認証して継続利用できる。初期はEmail OTP等、Android/iOS双方で共通利用しやすい方式を優先する。 | Must |
| FR-002 | プロフィール | 表示名等、対戦・募集に必要な最小プロフィールを保持できる。 | Must |
| FR-003 | ゲーム一覧 | 公開中のゲームを一覧表示し、人数・所要時間・概要を確認できる。 | Must |
| FR-004 | ルール表示 | 各ゲームのルール、勝利条件、操作方法をアプリ内で確認できる。 | Must |
| FR-005 | 募集作成 | ゲーム、募集人数、開始目安、コメント等を指定して募集を投稿できる。 | Must |
| FR-006 | 募集閲覧／参加 | 募集一覧から参加し、空き枠・状態を確認できる。 | Must |
| FR-007 | 対戦ルーム | 2〜4人が同一ルームに入り、準備完了後にゲームを開始できる。 | Must |
| FR-008 | オンライン対戦 | 離れた端末間でゲーム状態・操作を同期し、ゲームを最後まで完了できる。 | Must |
| FR-009 | サーバー検証 | クライアントの操作要求をサーバー側でルール検証してから状態へ反映する。 | Must |
| FR-010 | 再接続 | 一時的な通信断後、現在のセッション状態を再取得して復帰できる。 | Must |
| FR-011 | ルームチャット | 対戦前後／対戦中に最低限のテキストコミュニケーションができる。 | Should |
| FR-012 | ゲーム追加 | 共通認証・募集・ルーム機能を変更せず、Game Definition等を追加して新しいゲームを登録できる。 | Must |
| FR-013 | ゲーム公開制御 | ゲームをDraft/Test/Published等の状態で管理できる。 | Must |
| FR-014 | 通報 | 募集投稿・チャット・ユーザー等をアプリ内から通報できる。 | Must |
| FR-015 | ブロック | 指定ユーザーからの交流を制限できる。 | Must |
| FR-016 | アカウント削除 | ユーザーが自身のアカウントと関連データの削除を要求できる。 | Must |
| FR-017 | 管理機能 | 運営者がゲーム公開状態、通報、問題ユーザー／投稿を確認・対応できる。 | Must |
| FR-018 | プレイ履歴 | 最低限、対戦セッションの結果と状態を運用調査できる形で保持する。 | Should |

# 7. ゲームプラットフォーム要件

ゲーム量産性を確保するため、各ゲーム固有ロジックとプラットフォーム機能を分離する。ゲームは、共通Game Engineが解釈・実行できるGame Definitionと、必要に応じた限定的な拡張実装で表現する。

Game Engine / Game DefinitionはモバイルUIおよびAndroid / iOS固有APIから独立したTypeScript層として実装する。

| ID | 領域 | 要件 | 優先 |
| --- | --- | --- | --- |
| GR-001 | 共通状態モデル | プレイヤー、ターン、得点、公開情報、プレイヤー別非公開情報を表現できる。 | Must |
| GR-002 | 共通コンポーネント | カード、山札、手札、ダイス、トークン、ボード／マス、カウンタ等を再利用できる。 | Must |
| GR-003 | Actionモデル | ユーザー操作を型付きActionとして表現し、実行可能性を検証できる。 | Must |
| GR-004 | 決定的な状態遷移 | 同一StateとActionから同一結果を得られる設計を原則とする。乱数はseed等で管理する。 | Should |
| GR-005 | 勝敗判定 | ゲーム終了条件と勝者／順位を機械判定できる。 | Must |
| GR-006 | 情報秘匿 | 手札等の非公開情報を他プレイヤーへ送信しない。 | Must |
| GR-007 | バージョニング | 進行中セッションがゲーム更新で破綻しないよう`game_version`を保持する。 | Must |
| GR-008 | Schema検証 | Game DefinitionをZod等で機械検証できる。 | Must |
| GR-009 | 自動シミュレーション | AI／ランダムPlayerで複数回実行できるインターフェースを持つ。 | Should |
| GR-010 | ストアポリシー考慮 | 外部から任意の実行コードを配信する方式を避け、データ駆動のゲーム定義を優先する。 | Must |
| GR-011 | OS非依存 | Game EngineおよびGame DefinitionはAndroid / iOS固有APIを参照しない。 | Must |
| GR-012 | Headless実行 | UIを起動せずNode.js等からルールテスト・simulationを実行できる。 | Must |

## 7.1 Game Definitionの概念要件

- `game_id` / `version` / 表示名 / 説明 / 対応人数 / 想定プレイ時間を定義できる。
- 初期状態、ターン構造、Action、勝利条件を定義できる。
- カード等のコンポーネントデータを定義できる。
- 表示用アセットとルール文を関連付けられる。
- 機械検証でき、不正な定義を公開できない。
- 将来、Agentが生成しやすいよう文法・制約を狭く保つ。
- Android / iOSで同一のGame Definitionを使用する。

## 7.2 ゲーム追加の原則

新しいゲームを追加する際、原則として以下を変更しない。

- 認証基盤
- 募集基盤
- ルーム基盤
- Supabase接続方式
- Android固有実装
- iOS固有実装

Game Engineの能力不足により共通基盤の変更が必要な場合は、特定ゲーム専用処理を直接追加するのではなく、再利用可能な共通機能として設計する。

# 8. データ要件

| データ群 | 主な内容 | 備考 |
| --- | --- | --- |
| users / profiles | 認証ID、表示名、状態 | 認証情報はSupabase Authを利用 |
| games / game_versions | ゲームメタ情報、公開状態、バージョン | Game Definitionとの整合を保持 |
| rooms / room_players | 参加者、定員、状態、ホスト | 募集と対戦開始を接続 |
| game_sessions | ゲームID、version、現在State、進行状態 | サーバーを正とする |
| game_actions | 誰が、いつ、どのActionを行ったか | 監査・リプレイ・不具合解析に利用可能 |
| recruitment_posts | 募集内容、人数、状態、開始目安 | UGCとしてモデレーション対象 |
| chat_messages | ルーム内メッセージ | UGCとしてモデレーション対象 |
| reports / blocked_users | 通報、対応状態、ブロック関係 | 運営・安全性に必須 |
| device_tokens | Push用端末情報 | OS種別を保持しPlatform Adapter経由で利用 |

## 8.1 データ保持方針

- 本番ユーザーデータをGitへ保存しない。
- 開発用seedは匿名・架空データのみとする。
- 削除要求に対応できるよう、ユーザーIDに紐づく関連データを把握できる設計とする。
- ゲーム進行データの保持期間はMVP運用前に決定する（未決）。
- Android / iOSでバックエンドのデータモデルを分けない。

# 9. 非機能要件

| ID | 領域 | 要件 | 優先 |
| --- | --- | --- | --- |
| NFR-001 | 可用性 | MVPでは商用SLAを独自保証しない。Supabase/EAS等のマネージド基盤を利用する。 | Must |
| NFR-002 | 性能 | 通常のターン操作がユーザー操作後おおむね1秒程度以内に他端末へ反映されることを目標とする。 | Should |
| NFR-003 | 同時実行 | MVPは小規模利用を対象とし、負荷試験により実測して上限を決める。 | Must |
| NFR-004 | 整合性 | 同一セッションに複数の競合Actionが来ても、状態遷移順序とversionを用いて不整合を防ぐ。 | Must |
| NFR-005 | セキュリティ | RLS、認証、サーバー側Action検証を前提とし、service role secretをクライアントへ含めない。 | Must |
| NFR-006 | プライバシー | 必要最小限の個人情報のみ取得し、両ストアの申告内容と整合させる。 | Must |
| NFR-007 | 保守性 | 機能・ゲーム・DB変更をGit上でレビュー可能にし、自動テストを通過させる。 | Must |
| NFR-008 | 移植性 | Android / iOS双方を継続サポートし、片OS固有依存による再実装を防ぐ。 | Must |
| NFR-009 | 観測性 | 主要エラー、Edge Function失敗、対戦状態の異常を調査できるログを残す。 | Should |
| NFR-010 | アクセシビリティ | 色のみで状態を表さず、文字サイズ・タップ領域等の基本的なモバイル可用性を確保する。 | Should |
| NFR-011 | 再現性 | 新規PCまたはAgent環境からRepoをcloneしてLocal環境を再構築できる。 | Must |
| NFR-012 | テスト容易性 | Game LogicはUIなしでUnit Testできる。 | Must |

# 10. セキュリティ・不正対策要件

- クライアントは「希望するAction」を送信し、ゲーム状態の最終決定はサーバー側で行う。
- 各API／Realtime Channelは、対象セッションへの参加権限を検証する。
- 非公開情報は対象プレイヤーにのみ返却する。
- DBは原則RLSを有効化し、利用者権限を明示する。
- Secret、API key、署名鍵、OAuth Secret等はGitへコミットしない。
- AgentにはProductionの破壊的権限を常時与えず、Local → Staging → Productionの段階を設ける。
- Android / iOSアプリ内に管理用Secretを含めない。
- AndroidとiOSのクライアントは同一のサーバー権限モデルを使用する。

# 11. UGC・ストア公開要件

募集掲示板とチャットはユーザー生成コンテンツ（UGC）に該当するため、公開時には利用規約、通報、ブロック、モデレーション、運営への連絡導線を備える。

アカウント作成機能を提供する場合は、Android / iOSそれぞれのストア要件を満たす削除導線を用意する。

| ID | 領域 | 要件 | 優先 |
| --- | --- | --- | --- |
| SR-001 | UGC利用規約 | 投稿前またはアカウント利用時に利用規約へ同意させ、不適切行為を明示的に禁止する。 | Must |
| SR-002 | 通報 | 投稿／ユーザーをアプリ内から通報できる。 | Must |
| SR-003 | ブロック | ユーザーをアプリ内でブロックできる。 | Must |
| SR-004 | モデレーション | 通報を運営が確認し、投稿削除・利用制限等を実施できる。 | Must |
| SR-005 | 不適切投稿対策 | 不適切な内容の投稿を抑止または検知する仕組みを設ける。 | Must |
| SR-006 | 運営連絡先 | ユーザーが運営へ連絡できる導線を提供する。 | Must |
| SR-007 | アカウント削除 | アプリ内からアカウント削除を開始できる。Google Play向けには外部Webリソースからも削除要求へ到達できるようにする。 | Must |
| SR-008 | 外部コード配信 | 任意の実行コードをダウンロードして新機能を追加する方式を避ける。ゲーム追加はデータ定義中心とする。 | Must |
| SR-009 | Store別確認 | Google Play / App Storeへの提出前に最新ポリシーを再確認する。 | Must |

# 12. 開発環境・構成管理要件

GitHubリポジトリを、アプリコード、Expo設定、Supabaseのスキーマ変更、ゲーム定義、テスト、構成文書の設計上の正本（Source of Truth）とする。

| ID | 領域 | 要件 | 優先 |
| --- | --- | --- | --- |
| DEV-001 | Monorepo | Expo、Admin、packages、games、Supabaseを原則1リポジトリで管理する。 | Must |
| DEV-002 | DB as Code | Supabaseのschema変更はmigrationとして保存し、Git管理する。 | Must |
| DEV-003 | Supabase Local | clone後にSupabase local stackを起動し、migration + seedから再構築できる。 | Must |
| DEV-004 | Expo Config as Code | `app.config.ts` / `app.json`、`eas.json`等の非Secret設定をGit管理する。 | Must |
| DEV-005 | Secret管理 | `.env`はコミットせず、`.env.example`とSecret管理基盤を利用する。 | Must |
| DEV-006 | 手動設定文書化 | Store、OAuth Provider等、Gitで完全管理できない設定は`docs/ops/`等に再現手順を記載する。 | Must |
| DEV-007 | 品質コマンド | lint、typecheck、unit test、game validation、simulationを統一コマンドで実行できる。 | Must |
| DEV-008 | CI | Pull Requestで最低限lint/typecheck/test/migration検証を自動実行する。 | Must |
| DEV-009 | 環境分離 | Local / Staging / Productionを分離する。 | Must |
| DEV-010 | Preview | Android / iOSの変更を本番前にDevelopment/Preview Buildで確認できる。 | Must |
| DEV-011 | Cross-platform Build | Android / iOS双方のBuildを継続的に実施する。 | Must |

## 12.1 Gitで管理するもの

- React Native / Expoソースコード
- `app.config.ts` / `app.json`
- `eas.json`
- TypeScript設定
- Supabase migration
- Supabase Edge Functions
- Supabase local config
- seed
- Game Definition
- ゲームアセット（容量・権利に応じてStorage等も利用）
- Unit / Integration / E2E Test
- GitHub Actions
- AGENTS.md
- 開発・運用ドキュメント

## 12.2 Gitに含めないもの

- `.env`実値
- Supabase service role key
- Apple / GoogleのSecret
- Signing key / certificateの生ファイル
- OAuth client secret
- 本番DBデータ
- 個人情報

# 13. AIエージェント開発要件

AIエージェントは「自由に本番を操作する存在」ではなく、リポジトリ内の規約・テスト・権限制御の中で作業する開発者として扱う。

| ID | 領域 | 要件 | 優先 |
| --- | --- | --- | --- |
| AI-001 | AGENTS.md | プロジェクト概要、禁止事項、構成、テスト、完了条件をrepo rootに記載する。 | Must |
| AI-002 | ローカル操作 | CodexがローカルGit repoを読み、ファイル編集・terminal実行・test実行できる。 | Must |
| AI-003 | クラウド操作 | 必要に応じてCodex Cloud等がGitHubのbranch/PR単位で独立作業できる。 | Should |
| AI-004 | 差分管理 | Agentの変更はGit diff／commit／PRとして人間がレビュー可能である。 | Must |
| AI-005 | 自動検証 | Agentが完了前に指定されたlint/typecheck/test/game:validate等を実行する。 | Must |
| AI-006 | Cross-platform確認 | Mobile変更時、Android/iOS双方への影響を確認し、片OS専用実装を無断で導入しない。 | Must |
| AI-007 | Dependency確認 | Native dependency追加時はAndroid / iOS双方の対応可否を確認する。 | Must |
| AI-008 | 本番保護 | Production DB・Store公開等の破壊的操作は原則人間承認を必要とする。 | Must |
| AI-009 | ゲーム生成 | 将来、仕様から`games/<id>`、定義、テストを生成できるインターフェースを整備する。 | Could |
| AI-010 | 自動バランス | 将来、simulation結果を用いてゲームパラメータを提案・調整できる。 | Could |

## 13.1 AGENTS.mdに必ず含めるCross-platform Rule

```md
## Cross-platform requirements

This application must support both Android and iOS from the beginning.

- All new features must be designed for both Android and iOS.
- Prefer platform-independent React Native / Expo APIs.
- Do not introduce Android-only or iOS-only dependencies without explicit justification.
- Keep game rules and domain logic completely platform-independent.
- Isolate unavoidable platform-specific code behind interfaces/adapters.
- Use `.android.ts(x)` / `.ios.ts(x)` only when necessary.
- Verify every new native dependency supports both Android and iOS.
- Do not assume Expo Go is the production development environment.
- Validate changes with Development Builds when native behavior is involved.
- Android and iOS buildability is part of Definition of Done.
```

## 13.2 推奨開発ツール構成

| 用途 | 推奨 | 位置づけ |
| --- | --- | --- |
| Agent主操作 | Codex / ChatGPTの開発Agent | 大きな実装、複数ファイル変更、テスト、並列作業 |
| 人間の編集・確認 | VS Code | コード閲覧、デバッグ、軽微修正、Markdown設計文書 |
| Terminal Agent | Codex CLI等 | 自動化、script実行、CIに近い検証 |
| Remote正本 | GitHub | branch、PR、CI、履歴、レビュー |
| Backend local | Supabase CLI + Docker | DB/Auth/Storage等のローカル再現 |
| App development | Expo Development Build | Android / iOS双方の実機・Simulator/Emulator確認 |
| App build | EAS Build | Development / Preview / Production build |

# 14. CI/CD・リリース要件

CI/CDでは、Androidのみ成功している状態を正常とみなさない。

## 14.1 Pull Request時

原則として以下を実行する。

```text
Pull Request
  ├─ install
  ├─ lint
  ├─ typecheck
  ├─ unit test
  ├─ game schema validation
  ├─ simulation smoke test
  ├─ Supabase migration validation
  └─ cross-platform checks
```

Native dependency、Expo config、権限、Plugin等に影響する変更ではAndroid / iOS双方のDevelopment/Preview Buildを必須とする。

## 14.2 main branch

```text
main
  ├─ Android Development/Preview Build
  └─ iOS Development/Preview Build
```

両OSのBuildが継続して成功する状態を維持する。

## 14.3 リリース種別

| 変更種別 | 検証 | リリース |
| --- | --- | --- |
| Game Definition / assetのみ | Schema検証、unit test、simulation、Preview | ゲーム公開フローでPublished化 |
| Game Engine / Mobile UI | lint、typecheck、unit、E2E、Android/iOS Preview | EAS Build → Internal/TestFlight等 → Store |
| Native dependency / Expo plugin | Android/iOS Development Build、実機確認 | EAS Build → 両OSテスト |
| DB schema | migration reset、RLS test、型生成 | Staging適用 → 人間確認 → Production migration |
| Edge Function | unit/integration、Staging | Staging → 人間確認 → Production deploy |

# 15. テスト要件

## 15.1 Unit Test

- Game Engine
- Game Rules
- State transition
- Action validation
- Score / win condition
- Game Definition validation
- Platform Adapter interfaceを利用するFeature logic

## 15.2 Integration Test

- Auth
- Room作成／参加
- Realtime同期
- Action送信／サーバー検証
- Reconnect
- RLS

## 15.3 Cross-platform Test Matrix

最低限、以下を確認する。

| テスト | Android | iOS |
| --- | --- | --- |
| 起動 | 必須 | 必須 |
| 認証 | 必須 | 必須 |
| ゲーム一覧 | 必須 | 必須 |
| 募集作成 | 必須 | 必須 |
| ルーム参加 | 必須 | 必須 |
| ゲーム開始 | 必須 | 必須 |
| Action同期 | 必須 | 必須 |
| 再接続 | 必須 | 必須 |
| ゲーム完了 | 必須 | 必須 |
| 通報／ブロック | 必須 | 必須 |
| アカウント削除 | 必須 | 必須 |

## 15.4 クロスOS対戦

MVP中に少なくとも以下を検証する。

```text
Android ─┐
         ├─ same room / same game session
   iOS ──┘
```

AndroidユーザーとiOSユーザーが同一ルームに参加し、同じゲームセッションを最後まで完了できること。

# 16. MVP受入条件

| ID | 受入条件 |
| --- | --- |
| AC-01 | AndroidアプリをDevelopment Buildとして起動できる。 |
| AC-02 | iOSアプリをDevelopment BuildまたはSimulator Buildとして起動できる。 |
| AC-03 | Android / iOS双方から同じSupabase環境へ接続できる。 |
| AC-04 | Android端末とiOS端末／Simulatorが同じ募集・ルームへ参加できる。 |
| AC-05 | 2〜4人のテストユーザーがインターネット越しにゲームを最後まで完了できる。 |
| AC-06 | Android / iOS混在で1ゲームを最後まで完了できる。 |
| AC-07 | 無効なActionを送信してもサーバーが拒否し、不正なStateへ遷移しない。 |
| AC-08 | 一時切断またはアプリ再起動後、現在Stateを取得して対戦に復帰できる。 |
| AC-09 | 最低2種類のゲームが同じ認証・募集・ルーム・Game Engine基盤上で動作する。 |
| AC-10 | Game Engine / Game LogicにAndroid / iOS固有APIへの依存がない。 |
| AC-11 | 新規Native dependencyはAndroid/iOS双方の対応が確認されている。 |
| AC-12 | 通報とブロックのユーザーフローが利用でき、運営側で通報を確認できる。 |
| AC-13 | 新しい開発環境でcloneし、手順に従ってローカルSupabaseとアプリを起動できる。 |
| AC-14 | Pull Requestで自動テストが実行され、失敗時はmergeしない運用ができる。 |
| AC-15 | main branchでAndroid / iOS双方のBuildが継続的に成功する。 |
| AC-16 | CodexがAGENTS.mdを参照し、1つの機能変更を実装→テスト→差分提示まで完了できる。 |
| AC-17 | Google Play / App Store公開に必要なプライバシー、アカウント削除、UGC安全対策の準備ができている。 |

# 17. 開発フェーズ

| Phase | 目的 | 主な成果物 |
| --- | --- | --- |
| 0. Foundation | AgentとAndroid/iOS双方が扱えるrepoを作る | Monorepo、AGENTS.md、Expo、Development Build、Supabase local、CI、環境変数設計 |
| 1. Cross-platform Skeleton | Android/iOS共通アプリの骨格を確認する | Expo Router、共通UI、Platform Adapter、Android/iOS Build |
| 2. Core Online | オンライン対戦の縦切りMVP | Auth、Room、Realtime、Server validation、単純ゲーム1本 |
| 3. Cross-OS Validation | 移植不要な構成を実証する | Android↔iOS混在対戦、Reconnect、Lifecycle確認 |
| 4. Platformization | ゲーム追加性を証明する | Game Engine、Game Schema、2本目、game_version、simulation |
| 5. Community | 一般公開に必要な交流・安全性 | 募集掲示板、チャット、通報、ブロック、Admin、削除導線 |
| 6. Store Release | 実ユーザーへ公開 | Android/iOS Production build、Store設定、監視、運用手順 |
| 7. AI Game Factory | ゲーム生成を効率化 | Agent生成script、Game Definition生成、自動simulation、PR化 |

## 17.1 Phase 0で最初に確認すること

ゲーム機能を大量実装する前に、以下を通す。

```text
Git clone
   ↓
install
   ↓
Supabase local start
   ↓
Android Development Build
   ↓
iOS Development/Simulator Build
   ↓
同じBackendへ接続
   ↓
CI成功
```

これにより、開発初期にiOS側のビルド不能要因を発見する。

# 18. 未決事項（実装前またはMVP中に決める）

| ID | 論点 | 決定タイミング／備考 |
| --- | --- | --- |
| O-01 | サービス名／ブランド | Store公開までに決定 |
| O-02 | 認証方式 | Email OTP / Google / Apple等から決定。両OSのStore要件を確認する |
| O-03 | 匿名利用 | ログイン必須とするか、一部ゲスト利用を許可するか |
| O-04 | ルームチャット範囲 | 対戦中も自由入力可か、定型文のみか |
| O-05 | Game DSLの表現力 | 完全データ駆動と限定Plugin APIの境界 |
| O-06 | ゲーム素材生成 | 生成AI画像を使用する場合のモデル・権利・表示ポリシー |
| O-07 | 保持期間 | game_actions、chat、report等の保持・削除期間 |
| O-08 | 年齢層 | 未成年を対象とするか。UGCモデレーション／ストア申告に影響 |
| O-09 | 収益化 | 無料、広告、課金、サブスク等。MVPでは対象外 |
| O-10 | Store公開順序 | Android / iOSを同時公開するか、公開時期をずらすか |
| O-11 | Push通知 | MVPに含めるか。含める場合はPlatform Adapterで実装 |
| O-12 | E2E環境 | Maestro等の候補からAndroid/iOS双方を扱える方式を選定 |

# 19. Definition of Done

すべての変更について、以下を満たすことを完了条件とする。

- 要求に対応するコード／migration／ゲーム定義がGit差分として存在する。
- lintが成功する。
- typecheckが成功する。
- 該当Unit Testが追加され、成功する。
- DB変更がある場合、ローカルでmigrationをゼロから適用できる。
- Game変更がある場合、schema validationとsimulationが成功する。
- UI変更がある場合、Development/Preview Buildで主要フローを確認する。
- Android / iOS双方への影響を確認する。
- 新しいNative dependencyを導入した場合、Android / iOS双方の対応を確認する。
- OS固有コードを追加した場合、その必要性と共通interfaceが明確である。
- Secretや本番データがcommitに含まれていない。
- 必要な`docs/`および`AGENTS.md`が更新されている。

Mobile Appの変更では、さらに以下を完了条件とする。

- Android Buildが成功する。
- iOS Buildが成功する。
- Game LogicへOS固有依存を持ち込んでいない。
- 主要なOS差分がPlatform Adapterの外に漏れていない。

# 20. 外部制約・公式資料

以下の公式資料は、2026-08-23時点で本要件に影響するものとして参照する。サービス仕様・ストアポリシーは変更され得るため、本番公開時に最新版を再確認する。

| 提供元 | 資料名 | 本書への影響 |
| --- | --- | --- |
| Expo | EAS Build | Android / iOS双方のクラウドBuild、Development/Preview/Production Build |
| Expo | Development builds | Expo Goだけに依存しないNative Moduleを含む開発環境 |
| Expo | Platform-specific extensions and module | `.android.tsx` / `.ios.tsx`等のOS別実装方法 |
| Supabase | Local development workflow | migration、seed、local環境をversion controlで再現 |
| Supabase | Managing Environments | Local / Staging / Productionの分離 |
| Apple | App Review Guidelines | UGC、アカウント、外部コード配信等の審査要件 |
| Apple | Offering account deletion in your app | アカウント作成対応アプリの削除導線 |
| Google Play | User-generated content policy | UGCの利用規約、通報、ブロック、モデレーション |
| Google Play | User Data / Account Deletion Requirement | アプリ内および外部Webでのアカウント削除要求 |

# 21. 本書から次に作る設計資料

1. **システム基本設計書**
   - Client / Backend / Game Engine / Platform Adapterの責務分割
   - 通信方式
   - Local / Staging / Production構成
   - Android / iOS Build構成

2. **初期リポジトリ設計**
   - Monorepo workspace
   - Expo Router
   - Supabase local
   - EAS設定
   - GitHub Actions

3. **AGENTS.md**
   - Cross-platform rules
   - Architecture rules
   - Test commands
   - Dependency rules
   - Definition of Done
   - Production操作制限

4. **Game Engine / Game Definition仕様書**
   - State
   - Action
   - Reducer
   - Schema
   - versioning
   - 情報秘匿
   - simulation

5. **DB設計書**
   - ER図
   - テーブル
   - RLS
   - index
   - 保持期間

6. **API / Realtime設計書**
   - Action送信
   - 状態同期
   - 再接続
   - 競合制御

7. **Cross-platform Test Plan**
   - Android
   - iOS
   - Android↔iOS混在対戦
   - Lifecycle
   - Permission
   - Deep Link / Push等の将来差分

---

## 推奨する次の作業

最初にPhase 0〜1を実装し、**ゲーム本体を作り込む前にAndroid / iOS双方のDevelopment Buildが通ることを確認する**。

その後、High Card程度の極小ゲームを利用して、以下を縦に接続する。

```text
Android / iOS App
       ↓
Auth
       ↓
Room
       ↓
Realtime
       ↓
Server-side Action Validation
       ↓
Game Engine
       ↓
Game Complete
```

この1本目をAndroid / iOS混在で完走できた時点で、Game Engine / Game Definitionを抽象化し、2本目のゲームを追加する。

この順序により、ゲーム実装が増えた後でクロスプラットフォーム設計をやり直すリスクを抑える。
