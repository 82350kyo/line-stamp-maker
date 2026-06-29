# LINEスタンプ プロンプトメーカー

ChatGPTに貼り付けるだけで、オリジナルLINEスタンプ49枚分のプロンプトが自動生成できる静的Webアプリです。
画像生成AIのAPIは一切使いません。外部ライブラリなし・完全オフライン動作。

---

## このアプリでできること

1. 参照写真（自分の顔など）を1〜3枚アップロードする
2. 変換タイプ・用途・デザイン系統・フォント感を選ぶ
3. ボタンを押すと「ChatGPTに貼り付けるプロンプト」が49枚分まとめて生成される
4. ChatGPTに画像を添付してプロンプトを貼れば、LINEスタンプ画像が作れる

---

## ローカルで開く方法

特別なセットアップは不要です。

```
index.html をダブルクリックしてブラウザで開くだけ
```

Node.js・npm・ビルドツールは一切不要。インターネット接続がなくても動作します。

---

## ファイル構成

```
line-stamp-maker/
├── index.html   ← メインページ（ここを開く）
├── style.css    ← デザイン・レイアウト
├── app.js       ← アプリのロジック（プロンプト生成など）
├── data.js      ← スタンプ文言・設定データ
├── README.md    ← このファイル
└── docs/        ← 設計ドキュメント（触らないこと）
```

---

## GitHub Pages で公開する手順

### 1. GitHubリポジトリを作成する

1. https://github.com/new にアクセス
2. Repository name を入力（例：`line-stamp-maker`）
3. Public を選択して「Create repository」をクリック

### 2. ファイルをプッシュする

```bash
# line-stamp-maker ディレクトリに移動
cd /Users/kyo/line-stamp-maker

# Gitを初期化
git init

# ファイルをステージング（docs/ ごと全て）
git add index.html style.css app.js data.js README.md

# コミット
git commit -m "first commit"

# ブランチ名を main に設定
git branch -M main

# リモートを設定（your-username を自分のGitHubユーザー名に変える）
git remote add origin https://github.com/your-username/line-stamp-maker.git

# プッシュ
git push -u origin main
```

### 3. GitHub Pages を有効にする

1. GitHubのリポジトリページを開く
2. 「Settings」タブをクリック
3. 左メニューの「Pages」をクリック
4. Source の欄を「Deploy from a branch」に設定
5. Branch を「main」、フォルダを「/ (root)」に設定
6. 「Save」をクリック

### 4. 公開URLを確認する

数分後に以下のURLでアクセスできるようになります：

```
https://your-username.github.io/line-stamp-maker/
```

---

## ChatGPTでの使い方

### ステップ1：参照画像を用意する
自分の顔写真など、スタンプにしたい人物の写真を1〜3枚用意します。
他人の顔写真の無断使用はLINE審査でNGです。

### ステップ2：このアプリでプロンプトを生成する
1. 画像をアップロード（プレビュー確認用）
2. 権利確認チェックボックスにチェック
3. 変換タイプ・用途・デザイン・フォントを選ぶ
4. 「プロンプト49枚を生成する」ボタンを押す

### ステップ3：ChatGPTで画像を生成する
1. ChatGPT（GPT-4oなど画像生成対応版）を開く
2. 参照写真をChatGPTの添付機能で添付する
3. 「マスタープロンプトをコピー」してChatGPTに貼り付け・送信
4. 返答を確認したら、個別プロンプトを1番から順に貼り付けていく
5. 各画像を保存する

### ステップ4：仕上げてLINEに申請する
1. 49枚の中から良い40枚を選ぶ（LINE公式の上限は40枚）
2. 背景を透過処理する（Photoshop・remove.bg など）
3. サイズを調整する（本体：370×320px、形式：透過PNG、1MB以下）
4. LINE Creator's Market（https://creator.line.me/）から申請する

---

## LINE スタンプ規格メモ

| 種類 | サイズ | 形式 |
|------|--------|------|
| スタンプ本体 | 370 × 320 px | 透過PNG、1MB以下 |
| メイン画像 | 240 × 240 px | PNG |
| タブ画像（アイコン） | 96 × 74 px | PNG |

---

## 注意事項

- 純粋なAI出力そのままでは審査に落ちる可能性があります。必ず自分で確認・仕上げをしてから申請してください。
- 他人の顔写真の無断使用はLINE審査規約違反です。
- 有名人・著名キャラクターの画像は著作権・肖像権の問題があります。
- このアプリはプロンプトを生成するだけです。画像の生成・保管は行いません。

---

## ライセンス

個人利用・商用利用ともに自由に使えます。
