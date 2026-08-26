# Web MVP セットアップ・実装ガイド

## 1. この資料でできること

このリポジトリには、将来のAndroid・iOS対応を妨げないExpoベースのWeb先行MVPが入っている。まずはブラウザ1枚でオセロのルールを検証し、次にSupabaseを接続して、2つのブラウザ間でオンライン対戦を確認する。

環境変数を設定しない場合でも、ローカル検証モードで盤面・操作・ゲームルールをすぐに試せる。オンラインモードでは、クライアントが盤面を直接保存せず、Edge Functionがゲームエンジンで検証してから状態を確定する。

~~~text
Web browser A ─┐
               ├─ Expo / React Native Web client
Web browser B ─┘             │
                              │ HTTPS / WSS
                              ▼
       Supabase Auth ─ Edge Functions ─ PostgreSQL
                              │
                              ▼
                     private Realtime channel
~~~

## 2. 実装済みの範囲

| 領域 | 実装内容 |
| --- | --- |
| Web UI | ロビー、ローカル検証、メールログイン、ルーム作成・参加、招待URL、オセロ盤面、パス、投了、結果表示 |
| Game Engine | 8方向の合法手判定、反転、パス、終局、勝敗、状態バージョンの検証 |
| Server | Supabase Migration、RLS、private Realtimeの認可、4本のEdge Function |
| 同期 | アクションはサーバーで検証・永続化してから、Realtimeで「再取得が必要」と通知する |
| テスト | Othello EngineのVitestテスト。WebクライアントのTypeScript型検査 |

ローカル検証モードは1つのブラウザで黒・白を交互に操作するためのものであり、オンライン対戦・認証・状態永続化は行わない。

## 3. ディレクトリと責務

~~~text
apps/client/                         Expo Router client（Webを先に検証）
  app/index.tsx                      ロビーとオセロ画面
  src/services/                      Auth、Edge Function、Realtime接続
  src/platform/*.web.ts              ブラウザ固有のURL・共有処理
packages/game-engine/                UI・Supabase非依存のOthello Engine
  src/othello.ts                     State / Action / 合法手 / 状態遷移
  test/othello.test.ts               ルールテスト
supabase/migrations/                 DB、RLS、サーバーコミット用RPC
supabase/functions/                  認証済みのEdge Function
doc/                                 要件、ゲーム仕様、本ガイド
~~~

packages/game-engine/src/othello.ts はWebクライアントとEdge Functionの両方から参照する。ゲームルールをUIとサーバーに二重実装しないことが、この構成の重要な約束である。

## 4. 事前準備

### 4.1 必要なもの

| 用途 | 必要なもの | 必須か |
| --- | --- | --- |
| ローカルWeb検証 | Node.js 20.19.4以上、npm、ブラウザ | 必須 |
| オンライン検証 | 上記に加えSupabaseアカウント | 必須 |
| SupabaseをPC内で動かす | Docker Desktopまたは互換ランタイム | 任意 |
| Web公開 | EAS Hostingまたは任意の静的ホスティング | 任意 |

Expo SDK 57 / React Native 0.86は、Node.js 20.19.4以上、またはNode.js 22.13以上を必要とする。古いNode.jsでは依存関係の導入はできても、Metro・Vite・React Nativeが実行に失敗する。

WindowsではNode.jsのLTS版を導入した後、新しいPowerShellを開いて次を確認する。

~~~powershell
node --version
npm --version
~~~

Node.jsが20.19.4未満の場合は、Node.js公式インストーラーまたは組織で認められたバージョン管理ツールで更新する。更新後に古いプロセスを閉じ、新しいターミナルを開く。

### 4.2 依存関係を導入する

リポジトリのルートで実行する。

~~~powershell
npm install
npm test
npm run typecheck
~~~

期待結果は、オセロゲームエンジンのテストがすべて成功し、型検査がエラーなしで終わること。

## 5. 最短: ブラウザ1枚でオセロを確認する

これはサーバー不要の検証経路である。

1. リポジトリのルートで次を実行する。

   ~~~powershell
   npm run web
   ~~~

2. Expoが表示したURL（通常は http://localhost:8081）をブラウザで開く。
3. 最初に表示される「ローカル検証」を選ぶ。
4. 明るい緑の点があるマスだけをクリックし、黒・白を交互に進める。
5. 合法手がないときは「パスする」を押す。盤面が埋まるか両者が置けなくなると勝敗が出る。

ローカル検証ではリロードすると初期状態へ戻る。これは意図した仕様であり、サーバーを設定せずに盤面・操作・ルールを確認するためのモードである。

静的成果物だけを作る場合は次を実行する。

~~~powershell
npm run export:web
~~~

成果物は apps/client/dist/ に出力される。これは静的ホスティングへアップロードできる。

## 6. Supabaseを使ったオンライン対戦のセットアップ

### 6.1 サーバーとしてSupabaseを採用する理由

| Supabase機能 | このMVPでの用途 |
| --- | --- |
| Auth | メールMagic Linkで本人を識別する |
| PostgreSQL | ルーム、参加者、確定済みゲーム状態、アクション履歴を保存する |
| Edge Functions | 認証・参加資格・状態バージョンを確認し、Othello Engineで手を検証する |
| Realtime Broadcast | 確定状態が更新されたことだけを参加者へ通知する |
| RLS | 非参加者がルームやRealtimeトピックへアクセスすることを防ぐ |

クライアントの EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY はブラウザに含まれる前提の公開キーである。SB_SECRET_KEY やservice_role keyを .env、Web成果物、Gitに入れてはいけない。Secret keyはSupabaseのEdge Function実行環境だけが利用する。

### 6.2 Hosted Supabaseプロジェクトを作る

1. [Supabase Dashboard](https://supabase.com/dashboard)で新規プロジェクトを作る。
2. プロジェクトのリージョンとDBパスワードを決め、作成完了まで待つ。
3. Dashboardの Connect から次の2つを控える。

   - Project URL
   - Publishable key（sb_publishable_ で始まるキー）

4. リポジトリのルートで環境変数ファイルを作る。

   ~~~powershell
   Copy-Item .env.example .env
   Copy-Item .env apps\client\.env -Force
   ~~~

   `npm run web`は`apps/client`を起点にExpoを起動するため、ルートの`.env`に加えて`apps/client/.env`にも配置する。

5. .envを開き、値を置換する。

   ~~~dotenv
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ~~~

.envは.gitignoreに含まれている。キーをチャット、Issue、スクリーンショット、コミットに貼り付けない。

### 6.3 Authの設定

Dashboardで Authentication > Providers > Email を開き、Emailログインを有効にする。MVPではメールMagic Linkを使うため、Google・AppleなどのOAuth設定は不要である。

続けて Authentication > URL Configuration で次を設定する。

| 項目 | ローカルWeb検証値 | 本番値の例 |
| --- | --- | --- |
| Site URL | http://localhost:8081 | https://play.example.com |
| Redirect URLs | http://localhost:8081 | https://play.example.com |

開発中にポートを変更した場合は、そのURLもRedirect URLsへ追加する。ここが未設定だと、メール内のリンクを開いた後にログイン状態へ戻れない。

### 6.3.1 メール送信（SMTP）の設定

Supabaseの標準メールサービスには送信制限がある。複数ブラウザ・複数アカウントで継続的にテストする場合は、Custom SMTPを設定する。

#### Resendを利用する場合

1. [Resend](https://resend.com/)でアカウントを作成する。
2. Resendの **Domains > Add Domain** で送信に使用する独自ドメインを登録する。
3. Resendに表示されたDNSレコードを、ドメイン管理サービスのDNS設定へ追加する。
   - SPF用MXレコード
   - SPF用TXTレコード
   - DKIM用CNAMEレコード
   - DMARCは任意
4. DNSレコードを追加した後、Resend画面の **I've added the records** または **Verify** を押す。
5. ドメインの状態が`Verified`になるまで待つ。DNSの反映には数分から数時間かかる場合がある。
6. Resendの **API Keys > Create API Key** でAPIキーを作成する。APIキーは再表示できないため、安全に保管する。

Supabase Dashboardの **Authentication > SMTP Settings** で次を設定する。

| 項目 | 設定値 |
| --- | --- |
| Enable custom SMTP | ON |
| Sender email address | Resendで認証済みのドメインのメールアドレス |
| Sender name | 任意。例：`AIBoardGame` |
| Host | `smtp.resend.com` |
| Port number | `465` または `587` |
| Username | `resend` |
| Password | Resendで作成したAPIキー |
| Minimum interval per user | `60`秒程度 |

送信元には、Resendで`Verified`になったドメインのアドレスを指定する。例えばドメインが`example.com`の場合は、次のようにする。

~~~text
noreply@example.com
~~~

設定を保存した後、Supabaseからログイン用Magic Linkを送信して確認する。

`onboarding@resend.dev`はResendのテスト用送信元であり、送信先などに制限がある場合がある。継続的なテストでは独自ドメインを認証して使用する。

SMTPパスワード、Resend APIキー、SupabaseのSecret key、`service_role` keyは、`.env`、Git、Issue、チャット、スクリーンショットへ保存・掲載してはいけない。

#### メール送信制限について

Supabase標準メールサービスで`email rate limit exceeded`が表示された場合、メール送信上限に達している。一定時間待つ、別のメールアドレスを使う、Custom SMTPを設定する、またはローカルSupabaseのInbucketを使う。

### 6.4 Realtimeをprivate channelにする

Dashboardの Realtime > Settings で Allow public access を無効にする。これにより、クライアントはprivate channelとして接続し、realtime.messagesに定義されたRLS policyで許可されなければ購読できない。

このリポジトリのMigrationは room:<room-id> というトピックを使い、room_membersに存在するユーザーだけがBroadcastを受信できるようにする。クライアントはゲーム状態そのものをBroadcastしない。通知を受けたら get-othello-room を呼び、サーバー確定状態を取得する。

### 6.5 Migrationを適用する

Supabase CLIは本リポジトリのdevDependenciesに含まれる。初回だけログインとリンクを行う。

~~~powershell
npx supabase login
npx supabase projects list
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
~~~

YOUR_PROJECT_REFはProject URLの https://<ここ>.supabase.co の部分である。

db pushの後、DashboardのTable Editorで次のテーブルが作成されていることを確認する。

- profiles
- rooms
- room_members
- game_sessions
- game_actions

MigrationはRLSとサーバー専用RPCも作る。Table Editorからゲーム状態を手作業で更新して検証してはいけない。状態が壊れ、アクション履歴との整合性を失う。

### 6.6 Edge FunctionのCORSとデプロイ

Edge Functionはブラウザから呼ばれるため、許可するWeb Originを設定する。ローカル検証では次でよい。

~~~powershell
npx supabase secrets set ALLOWED_ORIGIN=http://localhost:8081
~~~

本番公開後は、必ず本番のHTTPS Originへ差し替える。

~~~powershell
npx supabase secrets set ALLOWED_ORIGIN=https://play.example.com
~~~

以下の4つをデプロイする。

~~~powershell
npx supabase functions deploy create-othello-room --use-api
npx supabase functions deploy join-othello-room --use-api
npx supabase functions deploy get-othello-room --use-api
npx supabase functions deploy submit-othello-action --use-api
~~~

--use-apiを指定するとDockerを使わずにデプロイでき、monorepoのpackages/game-engineを関数から参照する構成にも対応しやすい。Hosted Supabase上の関数にはSUPABASE_URL、Publishable key、Secret keyが実行環境として提供されるため、これらを手動でSecretへ登録しない。

### 6.7 2ブラウザで検証する

1. ルートの`.env`と`apps/client/.env`にSupabase設定を記載した状態で、`npm run web`を実行する。`.env`を変更した場合は、開発サーバーを`Ctrl+C`で停止してから再起動する。
2. 通常のブラウザでWebアプリを開き、「オンライン対戦」を選ぶ。
3. 黒番のメールアドレスと表示名を入力し、「ログインリンクを送る」を押す。メールのリンクを同じブラウザで開く。
4. 「黒番としてルームを作る」を押す。
5. 「招待リンクをコピー」を押す。
6. シークレットモードまたは別ブラウザで招待リンクを開く。通常ブラウザとは異なるメールアドレスでログインする。
7. 表示名を入力し、「白番として参加する」を押す。
8. 黒・白の順に手を置く。相手側の盤面がRealtime通知後に更新されることを確認する。
9. 片方のタブをリロードし、同じ招待URLを開く。確定済みの状態に復帰することを確認する。

招待URLは現在、ルームIDを含む ?room=<UUID> 形式である。招待トークンの有効期限・使用回数を持つ方式は、一般公開前に追加する。

## 7. PC内だけでSupabaseを動かす（任意）

ローカルSupabaseはDocker DesktopまたはDocker互換ランタイムを必要とする。Dockerを起動した後、リポジトリのルートで実行する。

~~~powershell
Copy-Item supabase/.env.local.example supabase/.env.local
npx supabase start
npx supabase db reset
npx supabase status
~~~

`supabase status`が表示するAPI URLとPublishable / anon keyをルートの`.env`へ設定する。URLは通常 `http://127.0.0.1:54321` である。Webクライアントにも反映するため、設定後に`apps/client/.env`へコピーする。

~~~dotenv
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase statusのPublishable key>
~~~

~~~powershell
Copy-Item .env apps\client\.env -Force
~~~

次に関数をホットリロード付きで動かす。

~~~powershell
npx supabase functions serve
~~~

ローカルのメールはInbucketで確認できる。設定済みのポートでは通常 http://localhost:54324 を開く。ローカルSupabaseをインターネットへ公開してはならない。

停止するときは以下を実行する。

~~~powershell
npx supabase stop
~~~

## 8. 実装上の重要な流れ

### 8.1 1手を置くとき

~~~text
1. Browser: place_disc + actionId + stateVersion を送る
2. Edge Function: JWT、ルーム所属、入力形式を検証する
3. Game Engine: 手番・合法手・反転・終局を計算する
4. DB RPC: stateVersionを条件にAction履歴と次状態を1トランザクションで確定する
5. DB: private Broadcastでstate_updatedを参加者へ通知する
6. Browser: get-othello-roomで確定済み状態を再取得する
~~~

古いstateVersion、異なる手番、非参加者、違法なマス、同じactionIdはサーバー側で拒否する。クライアントの盤面表示は便利なUIであって、勝敗や反転の最終決定者ではない。

### 8.2 ゲーム追加時のルール

新しいゲームを追加する際は、まずpackages/game-engineに純粋なState / Action / 状態遷移 / テストを追加する。その後にEdge Functionから同じEngineを呼び、最後にUIを作る。ゲーム固有コードへwindow、React、Supabaseを直接持ち込まない。

## 9. Web公開

### 9.1 静的出力の検証

~~~powershell
npm run export:web
~~~

apps/client/distを静的ホスティングへ配置する。対局画面はログイン後にSupabase Edge Functionへ接続するため、Webサーバー側の独自APIは不要である。

### 9.2 EAS Hostingを使う場合

ExpoのEAS Hostingを使う場合の基本コマンドは以下である。

~~~powershell
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest deploy
~~~

初回はCLIの案内に従ってExpoプロジェクトとPreview URLを作る。公開URLが決まったら、そのURLをSupabase AuthのSite URL / Redirect URLsと、ALLOWED_ORIGINへ反映する。URL設定を変えた後はEdge Functionsを再デプロイする。

~~~powershell
npx supabase secrets set ALLOWED_ORIGIN=https://YOUR_WEB_HOST
npx supabase functions deploy --use-api
~~~

公開URLが変わるPreview環境ごとにCORS Originを1つずつ設定する必要がある。複数のPreviewを恒常的に使う段階では、許可Originを厳密に検証するCORS実装へ拡張する。

## 10. テストのチェックリスト

### ローカル検証

- npm testが成功する。
- npm run typecheckが成功する。
- 初期局面で黒の合法手が4つだけ表示される。
- 置いた石と挟んだ石が正しく反転する。
- 合法手がない局面でだけパスできる。
- 投了と終局時に勝者が正しく表示される。

### オンライン検証

- 2つの異なるメールアドレスでログインできる。
- 黒が作成し、白が招待URLから参加できる。
- 相手の手を別ブラウザで受け取れる。
- 同時に操作した場合、片方だけが確定し、もう片方は再同期される。
- 非参加のユーザーがルームIDだけで状態を取得できない。
- タブのリロード後に確定済み状態へ戻れる。

## 11. よくある問題

| 症状 | 原因 | 対処 |
| --- | --- | --- |
| styleTextがない、Metroが起動しない | Node.jsが古い | Node.js 20.19.4以上または22.13以上へ更新し、ターミナルを開き直す。 |
| Magic Link後にログインへ戻れない | AuthのRedirect URL未登録 | DashboardのURL Configurationへ、実際のWeb URLを追加する。 |
| Edge FunctionがCORSで失敗する | ALLOWED_ORIGINが異なる | 実行中のWeb OriginをSecretへ設定し、関数を再デプロイする。 |
| ルーム参加後に相手の画面が更新しない | Realtimeがpublic設定のまま、またはpolicy未適用 | Migrationを適用し、Realtime > SettingsでAllow public accessを無効にする。 |
| ROOM_FORBIDDEN | ルームのメンバーでない | 招待URLを開いたあと、別のアカウントでログインして「参加する」を実行する。 |
| INVALID_VERSION | 他方が先に手を確定した | 画面が再同期するのを待ち、最新盤面で操作する。 |
| email rate limit exceeded | Supabase標準メールサービスの送信上限 | 一定時間待つ、別のメールアドレスを使う、またはResendなどのCustom SMTPを設定する。 |
| SMTPメールが送信できない | 送信元ドメイン未認証、またはSMTP情報の誤り | Resendのドメイン状態を`Verified`にし、Host・Port・Username・Passwordを確認する。 |
| npx supabase startが失敗する | Dockerが未導入・未起動 | Docker Desktopを起動する。Hosted Supabaseだけを使うならDockerは不要。 |

## 12. 次に進める順序

1. Node.jsを必要バージョンへ更新し、ローカル検証でオセロの操作を確認する。
2. Hosted Supabaseで2ブラウザ対戦を成立させる。
3. PlaywrightによるWeb E2Eを追加し、作成・参加・一手・リロード復帰を自動化する。
4. 招待トークン、有効期限、ルーム一覧、接続状態を追加する。
5. Android / iOS Development Buildを追加し、同じapps/clientとpackages/game-engineで混在対戦を検証する。

## 13. 公式資料

- [Expo Router: Universal React Native applications](https://docs.expo.dev/router/introduction/)
- [Expo: Develop websites with Expo](https://docs.expo.dev/workflow/web/)
- [Expo: Work with monorepos](https://docs.expo.dev/guides/monorepos/)
- [Expo: Publish your web app](https://docs.expo.dev/deploy/web/)
- [Supabase: Local Development & CLI](https://supabase.com/docs/guides/local-development)
- [Supabase: Edge Functions quickstart](https://supabase.com/docs/guides/functions/quickstart)
- [Supabase: Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase: Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
