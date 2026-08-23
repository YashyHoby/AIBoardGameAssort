# オンラインボードゲームプラットフォーム

## 要件定義書

**MVP / AIエージェント開発基盤**

| 項目 | 内容 |
| --- | --- |
| 文書バージョン | 0.1（ドラフト） |
| 作成日 | 2026-08-23 |
| 対象 | Androidを主対象とする2〜4人用オンラインボードゲームプラットフォーム |
| 想定技術 | React Native / Expo, Supabase, TypeScript, GitHub, Codex |
| 文書目的 | MVPの開発範囲と、将来的なボードゲーム量産基盤の要件を合意可能な形で定義する |

# 0. 文書の位置づけ

本書は、スマートフォン上で複数種類のボードゲームをオンライン対戦できるプラットフォームについて、初期開発（MVP）に必要な要件と、将来的に生成AI／Codexを用いてゲームを継続追加するための開発基盤要件を定義する。

> 本書は「何を満たすべきか」を定める要件定義書であり、画面遷移の全詳細、API仕様、DBの全カラム、Game DSLの文法などは後続の基本設計・詳細設計で定義する。

## 0.1 要件の区分

| 区分 | 意味 |
| --- | --- |
| 確定 | これまでの検討で実現対象として扱う要件 |
| 推奨 | 現時点の技術・運用上、採用を推奨する設計方針 |
| 未決 | 実装開始前またはMVP検証後に決定する事項 |

## 0.2 優先度

| 優先度 | 意味 |
| --- | --- |
| Must | MVP公開に必須 |
| Should | MVPで可能な限り実装。欠けても限定公開は可能 |
| Could | MVP後に追加可能 |

# 1. 背景・目的

生成AIを利用すると、ゲームの企画、ルール案、カードやパラメータ、実装、テストコード等を高速に生成できる。一方、ゲームごとに独立したアプリを作成すると、オンライン通信、アカウント、募集、ストア審査、運用を毎回構築する必要があり、量産性が低い。

そこで、共通のアプリ／バックエンド／ゲームエンジンを持つプラットフォームを先に構築し、新しいゲームを「共通仕様に従ったゲーム定義」として継続的に追加できる状態を目指す。

## 1.1 プロダクト目標

- 2〜4人がインターネット越しにスマートフォンからボードゲームを遊べる。

- 1つのアプリ内で複数のボードゲームを選択して遊べる。

- ユーザーがアプリ内で一緒に遊ぶ相手を募集できる。

- 新しいゲームを既存の共通基盤へ低コストで追加できる。

- 将来的にCodex等のAIエージェントが、ゲーム生成・実装・テスト・PR作成まで一貫して行える。

## 1.2 成功指標（MVP）

| ID | 指標 | 目標 |
| --- | --- | --- |
| KPI-01 | オンライン対戦成立 | 2〜4人が同一ルームへ参加し、最後まで1ゲーム完了できる |
| KPI-02 | 複数ゲーム対応 | 同一アプリ上で最低2種類のゲームが共通基盤を利用して動作する |
| KPI-03 | ゲーム追加性 | 既存の認証・募集・ルーム機能を変更せずに3本目を追加できる |
| KPI-04 | 再現可能な開発環境 | Git clone後、文書化されたコマンドでアプリ・ローカルSupabase・テストを起動できる |
| KPI-05 | Agent開発 | Codexがリポジトリの規約に従って変更・テスト・差分提示を行える |

# 2. 対象範囲

## 2.1 MVPに含める範囲

- Androidアプリ（Google Play公開を想定）。

- ユーザー認証・プロフィールの最小機能。

- ゲーム一覧・ゲーム詳細・ルール表示。

- 募集掲示板、募集への参加、対戦ルーム。

- 2〜4人のリアルタイム／ターン制オンライン対戦。

- ゲーム状態のサーバー側検証と同期。

- 最低2種類のゲーム。

- 通報・ブロック・最低限のモデレーション導線。

- 管理者向けの最低限の運用機能。

- GitHub中心の開発、CI、自動テスト、Supabase migration管理。

## 2.2 MVP外（将来候補）

- iOS版の一般公開（設計上は将来対応可能とする）。

- 課金、サブスクリプション、広告。

- 音声通話、ビデオ通話。

- ランキング、レーティング、トーナメント。

- フレンド／フォローの高度なSNS機能。

- AIが完全自動で本番公開する仕組み。

- AI Game Factoryによる大量自動生成・自動バランス調整。

# 3. 想定ユーザーと主要ユースケース

| ユーザー | 目的 | 主な行動 |
| --- | --- | --- |
| 一般プレイヤー | オンラインで気軽に遊ぶ | ログイン、ゲーム選択、募集検索、参加、対戦、チャット、通報 |
| 募集者／ルームホスト | 一緒に遊ぶ人を集める | 募集作成、参加者確認、開始、ルーム管理 |
| 運営者 | サービスを安全に維持する | ゲーム公開管理、通報確認、ユーザー／投稿対応、障害確認 |
| 開発者／AI Agent | ゲーム・機能を継続追加する | コード変更、migration、テスト、PR、Preview確認 |

# 4. システム全体構成

推奨構成は、モバイルアプリ、Supabaseバックエンド、ゲームエンジン／Game Definition、管理Web、GitHub／CI/CDの5領域からなる。

| 領域 | 推奨技術 | 役割 |
| --- | --- | --- |
| Mobile App | React Native + Expo + TypeScript | ゲーム一覧、募集、ルーム、ゲームUI、チャット |
| Backend | Supabase | Auth、PostgreSQL、Realtime、Storage、Edge Functions |
| Game Platform | TypeScript package + Game Definition | ターン、カード、山札、得点、勝敗、公開／非公開情報等の共通処理 |
| Admin | Next.js（推奨） | ゲーム公開、通報・ユーザー管理、運用確認 |
| Dev / CI | GitHub + Codex + GitHub Actions + EAS | コード正本、AI開発、自動テスト、ビルド・配布 |

## 4.1 リポジトリ構成（推奨）

```text
boardgame-platform/
├─ apps/mobile/             # Expo / React Native
├─ apps/admin/              # 運営Web
├─ packages/game-engine/    # 共通ゲームエンジン
├─ packages/game-schema/    # Game Definitionの型・検証
├─ packages/shared/         # 共通型・ユーティリティ
├─ games/<game-id>/         # 各ゲーム定義・素材・テスト
├─ supabase/migrations/     # DB変更履歴
├─ supabase/functions/      # Edge Functions
├─ supabase/seed.sql        # 開発用データ
├─ tests/                   # 結合/E2E
├─ scripts/                 # 生成・検証・シミュレーション
├─ docs/                    # 設計・運用文書
├─ .github/workflows/       # CI/CD
└─ AGENTS.md                # Agent向け開発規約
```

# 5. 機能要件

| ID | 機能 | 要件 | 優先 |
| --- | --- | --- | --- |
| FR-001 | アカウント | ユーザーが認証して継続利用できる。初期はメールまたはOAuthのいずれかを採用する。 | Must |
| FR-002 | プロフィール | 表示名等、対戦・募集に必要な最小プロフィールを保持できる。 | Must |
| FR-003 | ゲーム一覧 | 公開中のゲームを一覧表示し、人数・所要時間・概要を確認できる。 | Must |
| FR-004 | ルール表示 | 各ゲームのルール、勝利条件、操作方法をアプリ内で確認できる。 | Must |
| FR-005 | 募集作成 | ゲーム、募集人数、開始目安、コメント等を指定して募集を投稿できる。 | Must |
| FR-006 | 募集閲覧／参加 | 募集一覧から参加し、空き枠・状態を確認できる。 | Must |
| FR-007 | 対戦ルーム | 2〜4人が同一ルームに入り、準備完了後にゲームを開始できる。 | Must |
| FR-008 | オンライン対戦 | 離れた端末間でゲーム状態・操作を同期し、ゲームを最後まで完了できる。 | Must |
| FR-009 | サーバー検証 | クライアントの操作要求をサーバー側でルール検証してから状態へ反映する。 | Must |
| FR-010 | 再接続 | 一時的な通信断後、現在のセッション状態を再取得して復帰できる。 | Should |
| FR-011 | ルームチャット | 対戦前後／対戦中に最低限のテキストコミュニケーションができる。 | Should |
| FR-012 | ゲーム追加 | 共通基盤を変更せず、Game Definition等を追加して新しいゲームを登録できる。 | Must |
| FR-013 | ゲーム公開制御 | ゲームをDraft/Test/Published等の状態で管理できる。 | Must |
| FR-014 | 通報 | 募集投稿・チャット・ユーザー等をアプリ内から通報できる。 | Must |
| FR-015 | ブロック | 指定ユーザーからの交流を制限できる。 | Must |
| FR-016 | アカウント削除 | ユーザーが自身のアカウントと関連データの削除を要求できる。 | Must |
| FR-017 | 管理機能 | 運営者がゲーム公開状態、通報、問題ユーザー／投稿を確認・対応できる。 | Must |
| FR-018 | プレイ履歴 | 最低限、対戦セッションの結果と状態を運用調査できる形で保持する。 | Should |

# 6. ゲームプラットフォーム要件

ゲーム量産性を確保するため、各ゲーム固有ロジックとプラットフォーム機能を分離する。ゲームは、共通Game Engineが解釈・実行できるGame Definitionと、必要に応じた限定的な拡張実装で表現する。

| ID | 領域 | 要件 | 優先 |
| --- | --- | --- | --- |
| GR-001 | 共通状態モデル | プレイヤー、ターン、得点、公開情報、プレイヤー別非公開情報を表現できる。 | Must |
| GR-002 | 共通コンポーネント | カード、山札、手札、ダイス、トークン、ボード／マス、カウンタ等を再利用できる。 | Must |
| GR-003 | Actionモデル | ユーザー操作を型付きActionとして表現し、実行可能性を検証できる。 | Must |
| GR-004 | 決定的な状態遷移 | 同一StateとActionから同一結果を得られる設計を原則とする。乱数はseed等で管理する。 | Should |
| GR-005 | 勝敗判定 | ゲーム終了条件と勝者／順位を機械判定できる。 | Must |
| GR-006 | 情報秘匿 | 手札等の非公開情報を他プレイヤーへ送信しない。 | Must |
| GR-007 | バージョニング | 進行中セッションがゲーム更新で破綻しないようgame_versionを保持する。 | Must |
| GR-008 | Schema検証 | Game DefinitionをJSON Schema/Zod等で機械検証できる。 | Must |
| GR-009 | 自動シミュレーション | AI／ランダムPlayerで複数回実行できるインターフェースを持つ。 | Should |
| GR-010 | ストアポリシー考慮 | 外部から任意の実行コードを配信する方式を避け、データ駆動のゲーム定義を優先する。 | Must |

## 6.1 Game Definitionの概念要件

- game_id / version / 表示名 / 説明 / 対応人数 / 想定プレイ時間を定義できる。

- 初期状態、ターン構造、Action、勝利条件を定義できる。

- カード等のコンポーネントデータを定義できる。

- 表示用アセットとルール文を関連付けられる。

- 機械検証でき、不正な定義を公開できない。

- 将来、Agentが生成しやすいよう文法・制約を狭く保つ。

# 7. データ要件

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

## 7.1 データ保持方針

- 本番ユーザーデータをGitへ保存しない。

- 開発用seedは匿名・架空データのみとする。

- 削除要求に対応できるよう、ユーザーIDに紐づく関連データを把握できる設計とする。

- ゲーム進行データの保持期間はMVP運用前に決定する（未決）。

# 8. 非機能要件

| ID | 領域 | 要件 | 優先 |
| --- | --- | --- | --- |
| NFR-001 | 可用性 | MVPでは商用SLAを独自保証しない。Supabase/EAS等のマネージド基盤を利用する。 | Must |
| NFR-002 | 性能 | 通常のターン操作がユーザー操作後おおむね1秒程度以内に他端末へ反映されることを目標とする。 | Should |
| NFR-003 | 同時実行 | MVPは小規模利用を対象とし、負荷試験により実測して上限を決める。 | Must |
| NFR-004 | 整合性 | 同一セッションに複数の競合Actionが来ても、状態遷移順序とversionを用いて不整合を防ぐ。 | Must |
| NFR-005 | セキュリティ | RLS、認証、サーバー側Action検証を前提とし、service role secretをクライアントへ含めない。 | Must |
| NFR-006 | プライバシー | 必要最小限の個人情報のみ取得し、プライバシーポリシーとData Safety申告に整合させる。 | Must |
| NFR-007 | 保守性 | 機能・ゲーム・DB変更をGit上でレビュー可能にし、自動テストを通過させる。 | Must |
| NFR-008 | 移植性 | iOS対応を阻害するAndroid固有依存を最小化する。 | Should |
| NFR-009 | 観測性 | 主要エラー、Edge Function失敗、対戦状態の異常を調査できるログを残す。 | Should |
| NFR-010 | アクセシビリティ | 色のみで状態を表さず、文字サイズ・タップ領域等の基本的なモバイル可用性を確保する。 | Should |

# 9. セキュリティ・不正対策要件

- クライアントは「希望するAction」を送信し、ゲーム状態の最終決定はサーバー側で行う。

- 各API／Realtime Channelは、対象セッションへの参加権限を検証する。

- 非公開情報は対象プレイヤーにのみ返却する。

- DBは原則RLSを有効化し、利用者権限を明示する。

- Secret、API key、署名鍵、OAuth Secret等はGitへコミットしない。

- AgentにはProductionの破壊的権限を常時与えず、Local → Staging → Productionの段階を設ける。

# 10. UGC・ストア公開要件

募集掲示板とチャットはユーザー生成コンテンツ（UGC）に該当するため、公開時には利用規約・通報・ブロック・モデレーション運用を備える。アカウント作成を提供する場合、Google Playの要件を踏まえてアカウント削除導線を設ける。

| ID | 領域 | 要件 | 優先 |
| --- | --- | --- | --- |
| SR-001 | UGC利用規約 | 投稿前またはアカウント利用時に利用規約へ同意させ、不適切行為を明示的に禁止する。 | Must |
| SR-002 | 通報 | 投稿／ユーザーをアプリ内から通報できる。 | Must |
| SR-003 | ブロック | ユーザーをアプリ内でブロックできる。 | Must |
| SR-004 | モデレーション | 通報を運営が確認し、投稿削除・利用制限等を実施できる。 | Must |
| SR-005 | アカウント削除 | アプリ内および外部Webリソースから削除要求へ到達できる。 | Must |
| SR-006 | 外部コード配信 | 任意コードをダウンロードして新機能を追加する方式を避ける。ゲーム追加はデータ定義中心とする。 | Must |

# 11. 開発環境・構成管理要件

GitHubリポジトリを、アプリコード・Supabaseのスキーマ変更・ゲーム定義・テスト・構成文書の設計上の正本（Source of Truth）とする。

| ID | 領域 | 要件 | 優先 |
| --- | --- | --- | --- |
| DEV-001 | Monorepo | Expo、Admin、packages、games、Supabaseを原則1リポジトリで管理する。 | Must |
| DEV-002 | DB as Code | Supabaseのschema変更はmigrationとして保存し、Git管理する。 | Must |
| DEV-003 | 再現性 | clone後にSupabase local stackを起動し、migration + seedから再構築できる。 | Must |
| DEV-004 | Secret管理 | .envはコミットせず、.env.exampleとSecret管理基盤を利用する。 | Must |
| DEV-005 | 品質コマンド | lint、typecheck、unit test、game validation、simulationを統一コマンドで実行できる。 | Must |
| DEV-006 | CI | Pull Requestで最低限lint/typecheck/test/migration検証を自動実行する。 | Must |
| DEV-007 | 環境分離 | Local / Staging / Productionを分離する。 | Must |
| DEV-008 | Preview | アプリ変更を本番前にPreview/Internal buildで確認できる。 | Should |

# 12. AIエージェント開発要件

AIエージェントは「自由に本番を操作する存在」ではなく、リポジトリ内の規約・テスト・権限制御の中で作業する開発者として扱う。

| ID | 領域 | 要件 | 優先 |
| --- | --- | --- | --- |
| AI-001 | AGENTS.md | プロジェクト概要、禁止事項、構成、テスト、完了条件をrepo rootに記載する。 | Must |
| AI-002 | ローカル操作 | CodexがローカルGit repoを読み、ファイル編集・terminal実行・test実行できる。 | Must |
| AI-003 | クラウド操作 | 必要に応じてCodex CloudがGitHubのbranch/PR単位で独立作業できる。 | Should |
| AI-004 | 差分管理 | Agentの変更はGit diff／commit／PRとして人間がレビュー可能である。 | Must |
| AI-005 | 自動検証 | Agentが完了前に指定されたlint/typecheck/test/game:validate等を実行する。 | Must |
| AI-006 | 本番保護 | Production DB・Store公開等の破壊的操作は原則人間承認を必要とする。 | Must |
| AI-007 | ゲーム生成 | 将来、仕様からgames/<id>、定義、テストを生成できるインターフェースを整備する。 | Could |
| AI-008 | 自動バランス | 将来、simulation結果を用いてゲームパラメータを提案・調整できる。 | Could |

## 12.1 推奨開発ツール構成

| 用途 | 推奨 | 位置づけ |
| --- | --- | --- |
| Agent主操作 | ChatGPT Desktop / Codex | 大きな実装、複数ファイル変更、テスト、並列作業 |
| 人間の編集・確認 | VS Code | コード閲覧、デバッグ、軽微修正 |
| Terminal Agent | Codex CLI | 自動化、script実行、CIに近い検証 |
| Remote正本 | GitHub | branch、PR、CI、履歴、レビュー |
| Backend local | Supabase CLI + Docker | DB/Auth/Storage等のローカル再現 |
| App build | Expo / EAS | Development/Preview/Production build |

# 13. CI/CD・リリース要件

コード変更とゲーム追加を分けて扱い、ゲーム追加のみで済む場合はストア更新への依存を抑える。ネイティブ機能・新しい共通UI部品等を追加する場合はアプリ新バージョンとしてEAS Build／ストア配布を行う。

| 変更種別 | 検証 | リリース |
| --- | --- | --- |
| Game Definition/assetのみ | Schema検証、unit test、simulation、Preview | ゲーム公開フローでPublished化 |
| Game Engine／Mobile UI | lint、typecheck、unit、E2E、Preview build | EAS Build → Internal/Closed test → Store |
| DB schema | migration reset、RLS test、型生成 | Staging適用 → 人間確認 → Production migration |
| Edge Function | unit/integration、Staging | Staging → 人間確認 → Production deploy |

# 14. MVP受入条件

| ID | 受入条件 |
| --- | --- |
| AC-01 | Android端末2台以上からログインし、同じ募集／ルームへ参加できる。 |
| AC-02 | 2〜4人のテストユーザーがインターネット越しにゲームを最後まで完了できる。 |
| AC-03 | 無効なActionを送信してもサーバーが拒否し、不正なStateへ遷移しない。 |
| AC-04 | 一時切断後、現在のStateを取得して対戦に復帰できる。 |
| AC-05 | 最低2種類のゲームが同じ認証・募集・ルーム・Game Engine基盤上で動作する。 |
| AC-06 | 通報とブロックのユーザーフローが利用でき、運営側で通報を確認できる。 |
| AC-07 | 新しい開発環境でcloneし、手順に従ってローカルSupabaseとアプリを起動できる。 |
| AC-08 | Pull Requestで自動テストが実行され、失敗時はmergeしない運用ができる。 |
| AC-09 | CodexがAGENTS.mdを参照し、1つの機能変更を実装→テスト→差分提示まで完了できる。 |
| AC-10 | Google Play公開に必要な基本情報、プライバシー、アカウント削除、UGC安全対策の準備ができている。 |

# 15. 開発フェーズ

| Phase | 目的 | 主な成果物 |
| --- | --- | --- |
| 0. Foundation | Agentが開発できるrepoを作る | Monorepo、AGENTS.md、Expo、Supabase local、CI、環境変数設計 |
| 1. Core Online | オンライン対戦の縦切りMVP | Auth、Room、Realtime、Server validation、High Card等の単純ゲーム1本 |
| 2. Platformization | ゲーム追加性を証明する | Game Engine、Game Schema、2本目、game_version、simulation |
| 3. Community | 一般公開に必要な交流・安全性 | 募集掲示板、チャット、通報、ブロック、Admin、削除導線 |
| 4. Store Release | 実ユーザーへ公開 | EAS Production build、Play Console、監視、運用手順 |
| 5. AI Game Factory | ゲーム生成を効率化 | Agent生成script、Game Definition生成、自動simulation、PR化 |

# 16. 未決事項（実装前に決める）

| ID | 論点 | 決定タイミング／備考 |
| --- | --- | --- |
| O-01 | サービス名／ブランド | Play Store公開までに決定 |
| O-02 | 認証方式 | Email OTP / Google Sign-In等からMVP方式を決定 |
| O-03 | 匿名利用 | ログイン必須とするか、一部ゲスト利用を許可するか |
| O-04 | ルームチャット範囲 | 対戦中も自由入力可か、定型文のみか |
| O-05 | Game DSLの表現力 | 完全データ駆動と限定Plugin APIの境界 |
| O-06 | ゲーム素材生成 | 生成AI画像を使用する場合のモデル・権利・表示ポリシー |
| O-07 | 保持期間 | game_actions、chat、report等の保持・削除期間 |
| O-08 | 年齢層 | 未成年を対象とするか。UGCモデレーション／ストア申告に影響 |
| O-09 | 収益化 | 無料、広告、課金、サブスク等。MVPでは対象外 |
| O-10 | iOS公開時期 | Android MVP後の利用状況を見て判断 |

# 17. 実装開始時の推奨「Definition of Done」

- 要求に対応するコード／migration／ゲーム定義がGit差分として存在する。

- lintとtypecheckが成功する。

- 該当Unit Testが追加され、成功する。

- DB変更がある場合、ローカルでmigrationをゼロから適用できる。

- Game変更がある場合、schema validationとsimulationが成功する。

- UI変更がある場合、開発端末またはPreviewで主要フローを確認する。

- Secretや本番データがcommitに含まれていない。

- 必要なdocs/AGENTS.mdが更新されている。

# 18. 参考：現時点での外部制約・公式資料

以下は2026-08-23時点で要件に影響する公式資料。ポリシーやサービス仕様は変更され得るため、本番公開時に再確認する。

| 提供元 | 資料名 | URL | 本書への影響 |
| --- | --- | --- | --- |
| Apple | App Review Guidelines | https://developer.apple.com/app-store/review/guidelines/ | 2.5.2: アプリ機能を変更する外部コードのダウンロード／実行に関する制約 |
| Google Play | User-generated content | https://support.google.com/googleplay/android-developer/answer/9876937 | UGCの利用規約、通報、ブロック、モデレーション |
| Google Play | User Data / Account Deletion Requirement | https://support.google.com/googleplay/android-developer/answer/10144311 | アカウント削除導線と関連データ削除 |
| Supabase | Local development workflow | https://supabase.com/docs/guides/local-development/cli-workflows | supabase/配下、migration、seedをversion controlで管理 |
| Supabase | Managing Environments | https://supabase.com/docs/guides/deployment/managing-environments | Local/Staging/Productionの環境管理 |
| Expo | EAS Build | https://docs.expo.dev/build/introduction/ | Expo/React NativeアプリのクラウドビルドとStore配布連携 |

# 19. 本書から次に作る設計資料

- システム基本設計書：責務分割、通信方式、環境構成、デプロイ方式。

- 画面／UX仕様：ゲーム一覧、募集、ルーム、対戦、通報、アカウント削除の画面遷移。

- Game Engine / Game Definition仕様書：State、Action、Reducer、Schema、versioning、情報秘匿。

- DB設計書：ER図、テーブル、RLS、index、保持期間。

- API／Realtime設計書：Action送信、状態同期、再接続、競合制御。

- Agent開発ガイド：AGENTS.md、コマンド、権限、テスト、PRルール。

> 推奨する次の作業は、Phase 0〜1に必要な「システム基本設計 + 初期ディレクトリ構成 + AGENTS.md」を作成し、High Card程度の極小ゲームでオンライン対戦を縦に通すこと。Game DSLの詳細化は、その1本目で必要な共通要素を確認してから行う。
