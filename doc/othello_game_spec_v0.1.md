# オセロゲーム仕様書

## 文書情報

- バージョン: 0.1
- 作成日: 2026-08-25
- 対象: オセロ MVP
- 目的: オセロのゲーム仕様・状態モデル・検証ルール・テスト条件を定義する

---

## 1. ゲーム概要

オセロは2人対戦のボードゲームである。8x8 の盤面に黒と白の石を置き、相手の石を挟むことでひっくり返す。最終的に盤面上の石の数が多い方が勝ちとなる。

MVPでは、次の前提を満たす。

- 2人固定
- 1対局 1 つのゲームセッション
- 役割は Black / White
- 各プレイヤーは自分の手番で合法手を置く
- サーバーが合法手と勝敗を検証する

---

## 2. ゲーム定義

### 2.1 プレイヤー

- Black
- White

各プレイヤーは以下の情報を持つ。

```ts
type Player = {
  id: string;
  name: string;
  color: 'black' | 'white';
  connected: boolean;
};
```

### 2.2 盤面

- 8 x 8
- 各マスの状態は `empty | black | white`

```ts
type Cell = 'empty' | 'black' | 'white';
type Board = Cell[][];
```

初期配置は以下のとおり。

```text
x x x x x x x x
x x x x x x x x
x x x x x x x x
x x x x W B x x
x x x x B W x x
x x x x x x x x
x x x x x x x x
x x x x x x x x
```

中心の4マスに、白2枚・黒2枚を置く。通常のオセロでは以下の配置になる。

```text
    d e f g
    4  . . . .
    5  . . . .
    6  . . W B
    7  . . B W
```

実装においては、盤面は 8 x 8 の二次元配列で表す。

---

## 3. 日本語ルール要件

### 3.1 手のルール

- プレイヤーは自分の色の石を置く
- 置いた石の周囲に、相手の色が連続して並び、その先に自分の石がある場合、挟まれた相手の石をひっくり返す
- 置ける場所は「合法手」である必要がある
- 合法手がない場合はパスする

### 3.2 パス

- 自分の手番で合法手が存在しない場合、パスとなる
- 両プレイヤーとも合法手がない場合は終局

### 3.3 終局判定

以下のいずれかで終局とする。

- 盤面がすべて埋まった
- 両方のプレイヤーが合法手を持たない

### 3.4 勝敗判定

終局後は各色の石数を比較する。

- black 石数 > white 石数 -> Black の勝利
- white 石数 > black 石数 -> White の勝利
- 同数 -> 引き分け

---

## 4. ゲーム状態モデル

```ts
type OthelloState = {
  gameId: 'othello';
  sessionId: string;
  stateVersion: number;
  phase: 'waiting' | 'playing' | 'finished';
  currentTurn: 'black' | 'white';
  board: Board;
  players: {
    black: Player;
    white: Player;
  };
  winner: 'black' | 'white' | 'draw' | null;
  lastActionId: string | null;
  turnCount: number;
  metadata: {
    passCount: number;
  };
};
```

---

## 5. アクション定義

### 5.1 `place_disc`

```ts
type PlaceDiscAction = {
  type: 'place_disc';
  gameId: 'othello';
  sessionId: string;
  actionId: string;
  playerId: string;
  stateVersion: number;
  payload: {
    row: number;
    col: number;
  };
};
```

### 5.2 `pass`

```ts
type PassAction = {
  type: 'pass';
  gameId: 'othello';
  sessionId: string;
  actionId: string;
  playerId: string;
  stateVersion: number;
  payload: {};
};
```

### 5.3 `resign`

```ts
type ResignAction = {
  type: 'resign';
  gameId: 'othello';
  sessionId: string;
  actionId: string;
  playerId: string;
  stateVersion: number;
  payload: {};
};
```

---

## 6. 合法手判定ロジック

### 6.1 基本条件

1. 盤面の指定位置が `empty` であること
2. 指定プレイヤーが現在の手番であること
3. 対局中であること
4. アクションの `stateVersion` が現在の状態と一致するか検証する
5. `actionId` が重複していないこと

### 6.2 判定方向

合法手は8方向すべてを確認する。

- 上
- 下
- 左
- 右
- 斜め上左
- 斜め上右
- 斜め下左
- 斜め下右

### 6.3 判定実装の要点

次のような手順で判定する。

1. 指定座標を確認
2. その座標が空マスであることを確認
3. 8方向の連続セルを順に確認
4. 最初に相手の石があり、さらに自分の石がある場合に合法手とみなす
5. 反転対象の座標一覧を返す

例:

```text
. . .
. W B
. . .
```

もし黒が置いた場合、白-黒の連続を挟んで黒があるなら、その白が反転対象になる。

---

## 7. 反転処理

合法手が確定した場合、反転対象の石をすべて自分の色に変える。

- 反転対象が 0 件なら不正手
- 反転後にターンを相手に渡す
- 次の状態の `stateVersion` を +1 する

---

## 8. パスと終了条件

### 8.1 パス条件

- そのプレイヤーに合法手が存在しない
- プレイヤーが明示的に `pass` を送信した

### 8.2 両者パス

- black と white の両方に合法手がない場合、対局終了
- `phase` を `finished` にする

### 8.3 終了時の結果

- black と white の石数を数える
- どちらが多いかで勝敗決定
- 引き分けもありうる

---

## 9. サーバー側検証ルール

サーバーは以下を必ず確認する。

- `playerId` は room membership に含まれているか
- `playerId` は現在手番のプレイヤーと一致するか
- `actionId` はユニークか
- `stateVersion` が最新か
- 盤面上の指定座標が空か
- その位置が合法手か
- 最終状態が終了状態か

以下のようなケースは拒否する。

- 盤面の範囲外
- すでに石があるマス
- 手番が違う
- 盤面が終了状態にある
- 同じ `actionId` の再送
- `stateVersion` の競合

---

## 10. 例外とエラーコード

| コード | 意味 |
| --- | --- |
| INVALID_MOVE | 合法手ではない |
| NOT_YOUR_TURN | 手番が違う |
| GAME_FINISHED | 終了済みの対局 |
| DUPLICATE_ACTION | action_id 重複 |
| INVALID_VERSION | state_version 不一致 |
| ROOM_FORBIDDEN | ルーム参加者でない |

---

## 11. UI要件

- 盤面は 8x8 の格子で表示する
- 置ける候補マスを視覚的にハイライトする
- タップ / クリックで手を進める
- 手番と勝敗を明示する
- 非公開情報は自分の色のみ見える
- 盤面の画面サイズに応じて適切に縮小する

---

## 12. テストケース

### 12.1 正常系

- 最初の盤面状態で合法手が 4 つ存在する
- 1手を置いて石が反転する
- 合法手がある場合に正しくターンが交代する
- 終局状態で勝敗が計算される

### 12.2 異常系

- すでに石のあるマスに置こうとする
- 相手の手番に置こうとする
- 合法手でない座標に置こうとする
- `stateVersion` のズレがある
- 重複 `actionId` を送る

### 12.3 再接続系

- 途中離脱後に最新状態を再取得する
- 同じゲームを別端末から再開できる
- サーバー上の状態に対してクライアント側のローカル状態を優先しない

---

## 13. 受入基準

MVPのオセロ実装が完了したと判断する条件:

- 2人が同じルームでゲーム開始できる
- 合法手と不正手が正しく判定される
- 石が反転し、ターンが進む
- 盤面が埋まるか両者パスで終局する
- 勝敗が正しく表示される
- 異なるクライアント間で同期される
- 重複送信や古い state_version の入力が拒否される

---

## 14. まとめ

オセロは、MVPとしてはシンプルだが、サーバー権威設計、状態同期、合法手判定、再接続、ゲーム固有仕様の切り分けを検証するには非常に適したゲームである。ここで設計と検証が成立すれば、次のゲーム追加にも応用できる。
