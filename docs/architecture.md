# AI LINEスタンプメーカー アーキテクチャ設計書

バージョン: 1.0  
作成日: 2026-06-29  
担当: architect-agent  
ステータス: 設計フェーズ（モデル選定はリサーチ待ち）

---

## 1. システム概要

ユーザーが自分の写真をアップロードし、AI画像生成を通じてLINEスタンプ用の画像セット（約49枚）を自動生成・ダウンロードできるWebアプリケーション。

### 基本方針

- コードはGitHubに公開するが、APIキーは一切リポジトリに含めない
- フロントエンドは静的ファイル（HTML/CSS/JS）として配信する
- APIキーを要するすべての外部呼び出しはサーバーレスFunctionを経由させる
- モデルは差し替え可能なインターフェースで抽象化する（モデル選定はリサーチ結果に委ねる）

---

## 2. システム構成図

```mermaid
graph TB
    subgraph ユーザーブラウザ
        UI[フロントエンド UI<br/>Vanilla JS + Vite]
        CANVAS[Canvas API<br/>後処理エンジン]
        ZIP[JSZip<br/>ダウンロード]
    end

    subgraph Cloudflare Pages
        STATIC[静的ファイル配信<br/>HTML / CSS / JS]
        FN_PROXY[Pages Function<br/>/api/generate<br/>APIキー秘匿プロキシ]
        FN_STATUS[Pages Function<br/>/api/status<br/>レート制限チェック]
    end

    subgraph 環境変数（Cloudflareダッシュボード）
        ENV[IMAGE_API_KEY<br/>RATE_LIMIT_KV_NS]
    end

    subgraph 外部サービス（TBD）
        AI_API[画像生成API<br/>モデルはリサーチ結果で決定]
    end

    subgraph Cloudflare KV
        KV[レート制限カウンター<br/>IPアドレス別]
    end

    UI -->|画像+パラメータ POST| FN_PROXY
    UI -->|制限チェック GET| FN_STATUS
    FN_PROXY -->|キー付きリクエスト| AI_API
    FN_PROXY --> ENV
    FN_STATUS --> KV
    AI_API -->|生成画像 URL/Base64| FN_PROXY
    FN_PROXY -->|生成結果| UI
    UI --> CANVAS
    CANVAS -->|後処理済み画像| ZIP
    STATIC --> UI
```

### 各レイヤーの責務

| レイヤー | 技術 | 責務 |
|---|---|---|
| フロントエンド | Vanilla JS + Vite | UI操作・進捗表示・Canvas後処理・ZIP生成 |
| 静的ホスティング | Cloudflare Pages | HTMLファイル配信（無料） |
| プロキシFunction | Cloudflare Pages Functions | APIキー隠蔽・レート制限・エラーハンドリング |
| 画像生成 | 外部API（TBD） | AI画像生成本体 |
| KVストア | Cloudflare KV | レート制限カウンター保管 |

---

## 3. 技術スタック

### 推奨構成（確定）

| 分類 | 採用技術 | 選定理由 |
|---|---|---|
| フロントエンド言語 | Vanilla JavaScript（ESモジュール） | フレームワーク不要な規模。ビルド依存を最小化し、GitHub Pages / Cloudflare Pages どちらでも動く |
| ビルドツール | Vite | 設定最小・HMR対応・本番ビルドが速い。学習コスト低 |
| スタイル | CSS（カスタムプロパティ活用） | 外部UIライブラリ不要な規模。依存ゼロ |
| ホスティング | Cloudflare Pages | 無料枠が大きい。GitHubリポジトリと連携しプッシュ時に自動デプロイ |
| サーバーレスProxy | Cloudflare Pages Functions（TypeScript） | Pagesと同一リポジトリで管理。`/functions`ディレクトリに置くだけで動作 |
| シークレット管理 | Cloudflare ダッシュボード 環境変数 | コードに秘密鍵を含めない唯一の方法 |
| レート制限ストア | Cloudflare KV | Pages Functionsから直接バインドできる。追加サーバー不要 |
| クライアント後処理 | Canvas API（ブラウザ組み込み） | リサイズ・余白付け・PNG書き出しをサーバーコスト無しで実行 |
| ZIP生成 | JSZip（クライアントサイドJS） | ブラウザだけでZIP生成可能。サーバー側処理不要 |
| 画像生成モデル | 未定（リサーチ結果待ち） | インターフェース設計のみ先行実施 |

### 採用しない選択肢とその理由

| 却下技術 | 理由 |
|---|---|
| React / Vue / Svelte | 今回の規模では過剰。ビルド複雑化・依存増加のデメリットが大きい |
| Vercel Serverless Functions | 無料枠の制約・ cold start が比較的遅い。Cloudflare Workers の方がエッジ実行で高速 |
| GitHub Actions + Lambda | 構成が複雑化する。Cloudflare Pagesで完結できる |
| サーバーサイドZIP生成 | サーバーリソースを消費し不要。JSZipで十分 |
| 背景透過のサーバー処理 | Canvas APIで代替可能。コスト削減 |

---

## 4. ディレクトリ構成（設計指針）

```
line-stamp-maker/
├── frontend/                   # 静的フロントエンド（Vite管理）
│   ├── index.html
│   ├── vite.config.js
│   ├── src/
│   │   ├── main.js             # エントリポイント
│   │   ├── uploader.js         # 画像アップロードUI
│   │   ├── generator.js        # 生成ジョブ管理（バッチ処理）
│   │   ├── postprocess.js      # Canvas後処理エンジン
│   │   ├── downloader.js       # ZIP生成・ダウンロード
│   │   ├── promptBuilder.js    # プロンプト組み立てロジック
│   │   └── ui/                 # UIコンポーネント群
│   └── public/
│       └── assets/
├── functions/                  # Cloudflare Pages Functions
│   └── api/
│       ├── generate.js         # 画像生成プロキシ（POST）
│       └── status.js           # レート制限チェック（GET）
├── docs/
│   └── architecture.md         # 本ドキュメント
└── .gitignore                  # .env・node_modules等を除外
```

---

## 5. 画像生成パイプライン設計

### 5.1 全体フロー（2ステップ方式）

49枚を一度に生成するのではなく、**ベースキャラクター生成 → バリエーション生成** の2ステップに分割する。

```
[Step 1] ベースキャラクター生成（1〜3回）
  入力: アップロード画像 × 1〜3枚 + 変換タイプ + デザイン系統
  出力: スタイル一貫性のある「基準キャラクター画像」1枚（または複数）
  目的: 49枚すべてで同じキャラクターが登場するようにする

[Step 2] バリエーション生成（最大49回、並列バッチ処理）
  入力: Step1のベース画像 + 表情パターン + テキスト内容 + フォント感
  出力: スタンプ画像 × 49枚
  目的: 表情・文言の違いでバリエーションを作る
```

この2ステップ構成の理由：
- **一貫性**: 全スタンプが同一キャラクターに見える（個別生成では崩れやすい）
- **コスト効率**: スタイル計算は1回。バリエーションはテキスト/表情差分のみ
- **再生成の柔軟性**: 気に入らないスタンプ1枚だけ差し替えが可能

### 5.2 49枚の構成（案）

```
表情カテゴリ × テキスト内容 = バリエーション数

例）
  7種の表情（喜・怒・哀・楽・照れ・驚き・無表情）
× 7種のテキスト（用途設定に応じたセリフ）
= 49枚

テキスト選択ロジック:
  用途「挨拶用」 → おはよう / よろしく / ありがとう / お疲れ / 了解 / いいね / また今度
  用途「仕事用」 → 確認しました / ご確認ください / お世話になります / など
  用途「友達向け」→ やばい / さいこう / えー / がんばれ / など

テキストなし枠も含めることを推奨（6〜8枚程度）
```

要確認: LINEスタンプの公式仕様では提出可能枚数は 8/16/24/32/40 枚のいずれか。  
「49枚」はLINEの正式な申請枚数ではないため、**40枚セット + 予備9枚（ユーザーが取捨選択）** という設計に変更することを推奨。

### 5.3 プロンプト設計方針

ユーザーの選択肢をプロンプトパラメータにマッピングするロジックを `promptBuilder.js` に集約する。モデル依存部分は外部に切り出し、モデル変更時は `promptBuilder.js` のテンプレートだけ更新する。

```
プロンプト構造 = ベーススタイル記述 + キャラクター記述 + 表情指定 + テキスト指定 + 技術的制約

ベーススタイル記述 のマッピング例:
  変換タイプ:
    キャラ化     → "anime character, 2D illustration"
    デフォルメ   → "chibi style, super deformed, SD character"
    そのまま加工  → "stylized photo, keep facial features, artistic filter"

  デザイン系統:
    イラスト調   → "soft illustration, clean lineart, anime style"
    ポップ系     → "pop art, vivid colors, bold outlines"
    スタイリッシュ→ "minimalist, sleek design, modern illustration"
    シュール     → "surreal, unusual composition, quirky"

  フォント感（テキストレンダリング方針）:
    手書き風     → クライアントのCanvas APIで手書きフォントをオーバーレイ
    丸ゴシック   → Canvas APIで丸フォントをオーバーレイ
    スタイリッシュ→ Canvas APIでサンセリフをオーバーレイ
    ※フォントは画像生成APIに任せず、Canvas後処理でオーバーレイする方式を推奨
      理由: フォントの再現性・位置調整・視認性のコントロールが容易
```

### 5.4 後処理（Canvas API によるクライアントサイド処理）

LINE申請用の規格に合わせた後処理はすべてブラウザのCanvas APIで行う。

```
LINE スタンプ公式規格（要確認: 申請時に最新仕様を再確認すること）
  画像サイズ: W370 × H320 px（最大 W740 × H640）
  形式: PNG（透過対応）
  ファイルサイズ: 1MB以内 / 枚
  透過: 背景透過が必要

後処理ステップ:
  1. 生成画像を受け取る（URL または Base64）
  2. Canvasに描画しリサイズ（370×320 に収まるよう縮小、余白は透過）
  3. フォントオーバーレイ（テキストあり枠のみ）
  4. PNG形式で書き出し（toDataURL('image/png')）
  5. 49枚分を JSZip に追加 → ZIP ダウンロード

クライアントサイドを選ぶ理由:
  - サーバーコスト ゼロ
  - 画像がサーバーを素通りしないのでプライバシーに有利
  - Canvasはモダンブラウザすべてで動作保証済み
```

---

## 6. 49枚並列生成ジョブ設計

### 方式比較

| 方式 | 所要時間（1枚5秒想定） | メリット | デメリット |
|---|---|---|---|
| 完全逐次（1枚ずつ） | 約4分 | 実装シンプル | 遅すぎてUX壊滅 |
| 完全並列（49同時） | 約5〜15秒 | 速い | レート制限に即抵触。コスト集中 |
| **バッチ並列（推奨）** | **約45〜90秒** | **速度と安定のバランス** | やや実装複雑 |
| バックグラウンドキュー | 非同期・通知制 | 大規模向き | 実装コスト大。今回は過剰 |

### 推奨: バッチ並列方式（並列数: 5〜8）

```
処理フロー:
  49枚を 5〜8枚単位のチャンクに分割
  チャンク1: 並列5リクエスト → 完了
  チャンク2: 並列5リクエスト → 完了
  ...（繰り返し）

  進捗バーで「X / 49 枚生成中」をリアルタイム表示
  失敗した枚は個別にリトライ（最大3回）
  中断ボタンを提供（途中でキャンセル可能）

並列数 5〜8 の根拠:
  - 多くの画像生成APIは同一キーで 5〜10 同時接続を許容
  - これ以上増やしてもレート制限エラーが増えるだけ
  - 5並列で49枚なら約10チャンク = 約50〜90秒（十分実用的）
```

---

## 7. モデル抽象化インターフェース設計

モデル選定はリサーチ結果に委ねるため、呼び出し層を抽象化する。

```javascript
// このインターフェースに従って実装すれば、モデル変更時は実装クラスだけ差し替えればよい

// ImageGeneratorInterface（設計サンプル / 実装はse-agentが行う）
class ImageGeneratorInterface {
  /**
   * ベースキャラクターを生成する
   * @param {File[]} referenceImages - ユーザーアップロード画像（1〜3枚）
   * @param {Object} styleParams     - { conversionType, designStyle }
   * @returns {Promise<string>}      - 生成画像のURL or Base64
   */
  async generateBaseCharacter(referenceImages, styleParams) {
    throw new Error('サブクラスで実装してください');
  }

  /**
   * バリエーションを1枚生成する
   * @param {string} baseCharacterRef - ベース画像の参照（URL or ID）
   * @param {Object} variationParams  - { expression, text, fontStyle }
   * @returns {Promise<string>}       - 生成画像のURL or Base64
   */
  async generateVariation(baseCharacterRef, variationParams) {
    throw new Error('サブクラスで実装してください');
  }
}

// 具体実装例（モデルAの場合 → モデルBに変えるときはこのクラスだけ差し替え）
class ModelAGenerator extends ImageGeneratorInterface {
  // ... モデルA固有の実装
}
```

---

## 8. セキュリティ・コスト設計

### 8.1 APIキー秘匿の仕組み

```
ユーザーブラウザ
  ↓ POST /api/generate（APIキーなし）
Cloudflare Pages Function（サーバーサイド）
  ↓ APIキーを環境変数から読み込み、ヘッダーに付加
外部画像生成API
```

- GitHubリポジトリにはAPIキーを含むファイルが存在しない
- Cloudflareダッシュボードの「環境変数」に `IMAGE_API_KEY` を設定
- `.gitignore` に `.env` を追加し、ローカル開発時も誤コミットを防ぐ

### 8.2 コスト概算と公開時リスク

```
1枚あたりのAPI呼び出しコスト（モデル未定のため仮定）:
  高精度モデル（GPT-4o / DALL-E 3 相当）: $0.04〜$0.08 / 枚
  中精度モデル（Stable Diffusion API等）: $0.003〜$0.01 / 枚

1セット49枚の概算:
  高精度モデル: $2〜$4 / セット
  中精度モデル: $0.15〜$0.50 / セット

「誰でも無料で使える」公開時のリスク:
  - 悪意ある大量生成で1日に数万円のコスト発生の可能性
  - Bot/スクレイピングによる自動大量リクエスト
```

### 8.3 対策オプション（段階選択）

以下のオプションを段階に応じて組み合わせる。

**オプションA: BYOK方式（Bring Your Own Key）【MVP→公開初期に推奨】**
- ユーザーが自分のAPIキーをUI上で入力してセッション内のみ利用
- サーバーにキーを保管しない（リクエストのたびにヘッダーで渡す）
- コスト爆発リスクがゼロ（ユーザーが自分のお金を使う）
- デメリット: ユーザーがAPIキーを持っていない場合は使えない

**オプションB: IPレート制限【公開時の基本防衛策】**
- Cloudflare KVを使い、IPアドレスごとに「1時間に最大N回」制限
- Cloudflare Pages FunctionsのKVバインディングで実装
- ボットへの基本的な抑止効果

**オプションC: ログイン必須化【本格公開時】**
- Cloudflare Access または認証サービスを利用
- ユーザーごとの利用履歴・制限管理が可能
- 実装コスト増加

**推奨方針**: MVP期間はBYOK方式で開始。公開版はBYOK＋IPレート制限の組み合わせ。

---

## 9. デプロイ構成

```
GitHubリポジトリ（コード公開、APIキーなし）
    ↓ Push to main / PR merge
Cloudflare Pages（自動デプロイ）
    ├── 静的ファイル配信（frontend/dist/）
    └── Pages Functions（functions/api/）
          ├── 環境変数: IMAGE_API_KEY（ダッシュボード設定）
          └── KVバインディング: RATE_LIMIT_KV

ローカル開発環境:
    wrangler dev コマンドで Functions ごとローカル実行
    .env ファイルにAPIキーを記載（.gitignore 必須）
```

---

## 10. 段階的実装計画

### Phase 1: MVP（個人利用版）

目標: 手元で動くプロトタイプを最速で作る

- BYOK方式（APIキーをUIで入力）でAPIキー管理を最も単純化
- ローカルで `vite dev` + `wrangler dev` で動作確認
- 固定プロンプトテンプレートで最低限のスタンプ生成
- Canvas後処理で LINE規格に変換 + ZIP ダウンロード
- 生成枚数は49枚より少なく（8〜16枚）から始めてもよい

完了条件: 自分の写真からスタンプが生成できZIPでダウンロードできること

### Phase 2: 公開版（GitHub Pages / Cloudflare Pages 公開）

目標: URLを共有して誰でも使える状態にする

- Cloudflare Pages へのデプロイ完了
- BYOK方式を維持（自分のAPIキーで使う）
- IPレート制限（Cloudflare KV）の実装
- UIの改善（進捗バー・エラーメッセージ・モバイル対応）
- プロンプト選択肢の充実（変換タイプ・デザイン系統・用途の全組み合わせ）
- README に使い方を記載

完了条件: 知人に共有してフィードバックをもらえること

### Phase 3: 本格公開版（管理コスト削減・スケール対応）

目標: 不特定多数に公開しても安定運用できる状態

- ユーザー認証の導入（Cloudflare Access など）
- 利用ログの収集（どのスタイルが人気か把握）
- エラーハンドリングの強化（API障害時のフォールバック）
- モデルの最適化（コスト vs 品質のバランス調整）
- 要検討: 有料プラン・クレジット制の導入

---

## 11. 未確定事項（要確認リスト）

| 項目 | 状態 | 確認先 |
|---|---|---|
| 画像生成モデルの選定 | リサーチ待ち | research-agentの調査結果 |
| LINEスタンプ申請の最新仕様（枚数・サイズ・ファイル形式） | 要確認 | LINE Creators Market 公式ドキュメント |
| 「49枚」という枚数の根拠 | 要確認 | LINE公式枚数は8/16/24/32/40枚のいずれか。40枚セット+予備に設計変更を推奨 |
| ベースキャラクター画像の参照方式 | モデル依存 | モデルが img2img をサポートするか・reference画像をどう渡すか |
| フォントオーバーレイをサーバー側でやるか否か | 検討中 | Canvas APIで十分か、フォント品質に問題があればサーバー移行 |
| モデルのAPIレート制限（同時接続数） | モデル依存 | 採用モデルのドキュメントで確認し、並列数を調整 |

---

## 12. 推奨構成の総括

本設計の推奨構成を1行で示すと：

**「Vanilla JS + Vite」フロントエンドを「Cloudflare Pages」で配信し、APIキーを「Pages Functions（環境変数）」で秘匿しながら画像生成APIを呼び出す。49枚生成は5〜8並列のバッチ処理で行い、後処理はすべてCanvas APIでクライアント側に委ねる。**

この構成を推奨する理由：
1. GitHubでコードを公開しながらAPIキーを完全に隠せる（Cloudflare環境変数）
2. 追加サーバーが不要で運用コストがほぼゼロ（Cloudflare Pages無料枠）
3. フレームワークなしのVanilla JSで学習・保守コストが低い
4. Canvas APIによるクライアント後処理でサーバー負荷ゼロ
5. Phase 1（個人利用）からPhase 2（公開）への移行がCloudflare設定変更のみで完結
