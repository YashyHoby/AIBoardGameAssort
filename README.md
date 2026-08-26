# Online Boardgame Platform

Android・iOS・Webを1つのゲーム基盤で接続するための、Web先行MVPです。最初のゲームとしてオセロを実装しています。

- Webのみのローカル検証: npm run web
- ゲームエンジンのテスト: npm test
- Web静的出力: npm run export:web
- Supabaseを設定した2ブラウザ間対戦: doc/web_mvp_setup_guide.md

実行にはNode.js 20.19.4以上（または22.13以上）が必要です。環境変数未設定時は、1つのブラウザで黒・白を交互に操作するローカル検証モードで起動します。

