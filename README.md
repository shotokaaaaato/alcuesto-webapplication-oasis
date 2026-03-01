# OASIS — デザインのデジタルテラリウム

## 1. プロジェクト概要

OASIS は、Figma デザインや既存 Web サイトからスタイル・構造を抽出し、AI を活用してページ制作を行う Web 制作プラットフォームです。

TOP ページには「砂漠のオアシス」をテーマにした没入型 3D インターフェースを採用し、「誰もがこの場所を求めていた。砂漠で潤いを求めるように。」というコンセプトのもと、クリエイティブ制作に潤いと直感的な体験をもたらします。

---

## 2. 技術スタック

| レイヤー | 技術 |
|---------|------|
| Frontend | React 18, Three.js (React Three Fiber + Drei), Tailwind CSS 3, Framer Motion, Monaco Editor, react-zoom-pan-pinch |
| Backend | Node.js (Express), Puppeteer (URL デザイン抽出), JSON File Store |
| AI | マルチプロバイダー対応 — DeepSeek (デフォルト), OpenAI (GPT-4o), Claude (claude-sonnet-4-20250514), Gemini (gemini-2.0-flash), Perplexity |
| External API | Figma REST API + Figma Plugin API |
| Infrastructure | Docker Compose (client:3000, server:4000) |
| Auth | bcryptjs + jsonwebtoken (JWT 7 日間有効) |

---

## 3. プロジェクト構造

```
oasis/
├── README.md
├── docker-compose.yml
├── .env
│
├── client/                              # React フロントエンド (port 3000)
│   ├── Dockerfile.dev
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx                     # エントリポイント (BrowserRouter + AuthProvider)
│       ├── App.jsx                      # ルーティング定義 (15 ページ)
│       ├── context/
│       │   └── AuthContext.jsx          # 認証状態管理
│       ├── hooks/
│       │   └── useApiKeys.js            # AI API キー管理 (localStorage + session)
│       ├── utils/
│       │   └── zipDownloader.js         # JSZip ベース Zip エクスポート
│       ├── pages/
│       │   ├── TopPage.jsx              # 3D オアシス + 切り株メニュー
│       │   ├── LoginPage.jsx            # ログイン / 新規登録フォーム
│       │   ├── DashboardPage.jsx        # Bento UI カードグリッド (8 枚)
│       │   ├── CompositionWizardPage.jsx # ★ ページ制作ウィザード (6 ステップ)
│       │   ├── FigmaImportPage.jsx      # Figma インポート (Web/Graphic 分類 + PC/SP ペア)
│       │   ├── CanvasPage.jsx           # 3D テラリウム + デザインツール
│       │   ├── AnalyticsPage.jsx        # OASIS アナリティクス (3D 制作傾向分析)
│       │   ├── SemanticExporterPage.jsx # AI コード変換 + Monaco Editor + プレビュー
│       │   ├── DnaLibraryPage.jsx       # デザインライブラリ (テンプレート一覧)
│       │   ├── DnaExtractPage.jsx       # Figma/URL からデザイン構造を抽出
│       │   ├── PartsPage.jsx            # テンプレートパーツ管理
│       │   ├── CodeLibraryPage.jsx      # AI 生成コード管理
│       │   ├── SettingsPage.jsx         # AI API キー・Figma トークン管理
│       │   ├── FigmaGuidePage.jsx       # プラグイン導入ガイド
│       │   └── FigmaSyncPage.jsx        # Figma Plugin 連携 UI
│       └── components/
│           ├── Canvas3D.jsx             # React Three Fiber ラッパー
│           ├── DesertBiome.jsx          # 砂漠バイオーム (切り株メニュー)
│           ├── ForestBiome.jsx          # 森バイオーム
│           ├── DnaNode.jsx              # DNA 3D ノード表示
│           ├── DnaPicker.jsx            # URL/セレクタ入力 → DNA 抽出
│           ├── FigmaTokenInput.jsx      # Figma Token 入力 + ヘルプモーダル
│           ├── ModelSelector.jsx        # AI モデル選択ドロップダウン
│           ├── PropertyPanel.jsx        # プロパティ編集パネル
│           ├── PageComposerModal.jsx    # ページ構成モーダル
│           ├── SectionReviewModal.jsx   # セクションレビューモーダル
│           └── composition/             # ★ ページ制作ウィザード用コンポーネント群
│               ├── PageInitModal.jsx           # Step 1: 初期設定
│               ├── StructurePlannerPanel.jsx   # Step 2: 構成プランニング (DnD 対応)
│               ├── SectionDesignMapper.jsx     # Step 3: デザインマッピング
│               ├── ReferenceConfigPanel.jsx    # Step 4: 詳細設定
│               ├── CompositionPreviewPanel.jsx # Step 5: セクション生成 + プレビュー
│               ├── PageOptimizerModal.jsx      # Step 6: 最終最適化
│               └── DesignPreviewModal.jsx      # デザインプレビュー (Figma 風操作)
│
├── server/                              # Express バックエンド (port 4000)
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js                     # サーバーエントリ + ルートマウント
│       ├── middleware/
│       │   └── auth.js                  # JWT 認証 (verifyToken, requireAdmin)
│       ├── routes/
│       │   ├── auth.js                  # /api/auth — 認証
│       │   ├── dna.js                   # /api/dna — デザイン抽出・管理
│       │   ├── figma.js                 # /api/figma — Figma Plugin 連携
│       │   ├── export.js                # /api/export — AI 変換・テンプレート・セクション生成
│       │   ├── compose.js               # /api/compose — ページ制作ウィザード
│       │   └── analytics.js             # /api/analytics — 制作傾向分析
│       ├── models/
│       │   ├── userStore.js             # ユーザー永続化 → data/users.json
│       │   ├── dnaStore.js              # デザイン永続化 → data/dna-library.json
│       │   ├── templateStore.js         # テンプレート永続化 → data/templates.json
│       │   └── compositionStore.js      # 制作プロジェクト永続化 → data/composition-projects.json
│       └── services/
│           ├── aiClientFactory.js       # マルチ AI プロバイダー統一インターフェース
│           ├── aiRefactorService.js     # AI コード変換 + サニタイズ後処理
│           ├── dnaExtractor.js          # Puppeteer による CSS/構造抽出
│           ├── figmaExtractor.js        # Figma API ノード → デザインデータ変換
│           ├── figmaService.js          # デザイン → Figma スタイル変換
│           ├── tailwindConfigGenerator.js # デザイン → tailwind.config.js 生成
│           └── templateHasher.js        # SHA-256 ハッシュ + カラーマップ抽出・置換
│
├── apps/
│   └── figma-sync/
│       └── plugin/                      # Figma Plugin (Figma デスクトップ内で実行)
│           ├── manifest.json
│           ├── code.js                  # createPaintStyle / createTextStyle
│           └── ui.html                  # Plugin UI (ES5 互換)
│
└── shared/
    └── dnaSchema.json                   # デザインデータ JSON Schema 定義
```

---

## 4. ページ・ルーティング

| パス | ページ | 認証 | 概要 |
|------|--------|------|------|
| `/` | TopPage | Public | 3D オアシス + 切り株メニュー (ログイン/登録/About) |
| `/login` | LoginPage | Public | ログイン / 新規登録フォーム |
| `/dashboard` | DashboardPage | Protected | Bento UI カードグリッド (8 枚) — 全機能への導線 |
| `/compose` | CompositionWizardPage | Protected | 構成先行型 6 ステップウィザードでページ制作 |
| `/figma-import` | FigmaImportPage | Protected | Figma フレーム一覧 + Web/Graphic 分類 + PC/SP ペアインポート |
| `/canvas` | CanvasPage | Protected | 3D テラリウム + デザインピッカー + プロパティパネル |
| `/analytics` | AnalyticsPage | Protected | 3D 空間での制作傾向可視化・デザイン分析 |
| `/export` | SemanticExporterPage | Protected | AI リファクタ + Monaco Editor + ライブプレビュー |
| `/library` | DnaLibraryPage | Protected | デザイン・アセット管理・テンプレート動的プレビュー |
| `/parts` | PartsPage | Protected | テンプレートパーツ管理・Zip エクスポート |
| `/code-library` | CodeLibraryPage | Protected | AI 生成コード一覧管理・Zip エクスポート |
| `/settings` | SettingsPage | Protected | AI API キー (5 社) + Figma Access Token 管理 |
| `/figma-guide` | FigmaGuidePage | Protected | Figma プラグインのダウンロード・インストール手順 |

---

## 5. コア機能と開発状況

### 5.1 ページ制作ウィザード (`/compose`) — 実装済み (改善中)

構成先行型の 6 ステップガイドで、Figma デザインと AI を組み合わせてページを構築する中核機能。

| Step | コンポーネント | 内容 |
|------|---------------|------|
| 1 | PageInitModal | ページ名・AI モデル・画像モード (Unsplash / CSS 装飾) を設定 |
| 2 | StructurePlannerPanel | セクション構成の定義 — AI 提案 or 手動追加。ドラッグ＆ドロップ並び替え対応 |
| 3 | SectionDesignMapper | 各セクションにデザインライブラリからデザインを割り当て。要素選択プレビューモーダル付き |
| 4 | ReferenceConfigPanel | Clone/Reference 各セクションの詳細設定 (色継承・フォント継承・コンテンツモード) |
| 5 | CompositionPreviewPanel | セクション生成 + リアルタイムプレビュー。並列生成対応 |
| 6 | PageOptimizerModal | AI による最終最適化 (SEO・アクセシビリティ) + PC/SP デバイスプレビュー + 保存 |

**セクション生成の 3 モード:**

| モード | 動作 | API コスト |
|--------|------|-----------|
| 完全再現 (Clone) + そのまま使用 | マスター画像のクロップ表示。API 不要 | 無料 |
| 完全再現 (Clone) + テキスト差し替え | AI がレイアウト維持でテキスト・画像を置換 | 有料 |
| デザイン参考 (Reference) | AI がデザインのスタイル (色・フォント・レイアウト) を参考に新規生成 | 有料 |
| 参照なし (None) | セクション名のみで AI が自由生成 | 有料 |

**最新の改善 (2026-03):**
- ドラッグ＆ドロップ並び替え (framer-motion Reorder)
- Step 3 → Step 2 に戻った際の構成保持
- デザインプレビューモーダルにインタラクティブキャンバス (Ctrl+ホイールズーム / Space+ドラッグパン / オートフィット)
- AI プロンプトへの DNA スタイル強制注入 (HEX カラー + style 属性 Override)
- プレビュー iframe への DNA CSS カスタムプロパティ注入
- Clone+そのまま使用セクションのマスター画像ベースプレビュー

### 5.2 Figma インポート (`/figma-import`) — 実装済み

- **Web / Graphic 分類**: インポート時にデザインタイプを選択
- **PC / SP ペアインポート**: Web デザインは PC・SP フレームをペアで取得 (`extract-figma-paired`)
- **デバイスフレーム**: `deviceFrames: { pc: {...}, sp: {...} }` — 各フレームに独立した elements + masterImage
- **マスター画像キャプチャ**: Figma Images API でフレームの高解像度レンダリング画像を取得・保存
- **ページ構造シミュレータ**: マスター画像上にリージョンを描画し、パーツ役割 (header/fv/section/footer/nav/cta) を割り当て
- **クローンモード**: パーツごとに Clone (完全再現) or Refactor (AI リビルド) を選択可能

### 5.3 デザイン抽出 — 実装済み

- **Figma 抽出** (全ユーザー): Figma Access Token + File Key → ノード選択 → 要素抽出
- **URL 抽出** (管理者のみ): Puppeteer で対象ページの computedStyle / 構造を再帰的に JSON 化
  - 著作権を遵守し、自己責任で使用する旨の同意チェックボックスを実装済み
- **自動保存**: 抽出時に `data/dna-library.json` へ自動永続化

### 5.4 3D Biomes (環境モード) — 基盤実装済み

- **Standard (Oasis)**: 砂漠のオアシス。ヤシの木と泉、キャンピングカー、切り株メニュー
- **Forest (森)**: 翡翠色のガラス質感、木漏れ日、舞い落ちる葉

### 5.5 Semantic Exporter (`/export`) — 実装済み

- **AI リファクタ**: デザインデータ → React + Tailwind コンポーネント変換
- **ハッシュキャッシュ**: SHA-256 ベースで同一構成の再リクエストをスキップ
- **テンプレートシステム**: マスターテンプレート登録 → 他デザインに色置換で適用
- **Tailwind Config 生成**: カラーパレット・フォント・border-radius → `theme.extend` 形式
- **プレビュー UI**: 左=Monaco Editor、右=iframe + Tailwind CDN ライブプレビュー
- **エクスポート**: クリップボードコピー / .jsx ダウンロード / tailwind.config.js ダウンロード

### 5.6 Figma Sync — 実装済み

- **アーキテクチャ**: Figma Plugin API (`createPaintStyle` / `createTextStyle`) + サーバー (データ提供)
- **Plugin**: `apps/figma-sync/plugin/` — Local Styles を自動作成・更新
- **重複処理**: 既存スタイル名と一致する場合は更新
- **Figma Pro プラン対応**: Variables API ではなく Local Styles を使用

### 5.7 マルチ AI プロバイダー — 実装済み

- **統一インターフェース**: `callAI(systemPrompt, userMessage, { provider, apiKey, maxTokens })`
- **対応プロバイダー**: DeepSeek (デフォルト), OpenAI (GPT-4o), Claude, Gemini, Perplexity
- **API キー管理**: クライアント側 localStorage (base64) or セッション限定保存
- **ModelSelector**: 再利用可能なドロップダウン。キー未設定のモデルは無効化表示

### 5.8 AI サニタイズシステム — 実装済み

AI コード出力時の品質保証を三重構造で実施:

**A. システムプロンプト (4 大洗浄ルール):**
1. トラッキングコード全除去 (GA, GTM, Facebook Pixel, Hotjar)
2. サイト固有 ID 削除 (wp-block-\*, elementor-\*, framer-\*)
3. DNA 変数置換 (ハードコード HEX → セマンティッククラス)
4. 汎用 React 出力 (環境非依存、セマンティック HTML)

**B. 標準コーディング規約:**
- カスタムクラスは snake_case / モバイルファースト / absolute 配置禁止 → flex/grid

**C. プログラム後処理 (`sanitizeComponentOutput`):**
- 正規表現による厳格除去 (トラッキング 15 パターン + CMS クラス 6 パターン + absolute 排除)

### 5.9 認証システム — 実装済み

- JWT ベース (7 日間有効) + bcryptjs パスワードハッシュ
- 管理者アカウントはサーバー起動時に自動シード
- ProtectedRoute で認証必須ページを保護

---

## 6. API エンドポイント一覧

### 認証 API (`/api/auth`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| POST | `/register` | - | ユーザー登録 |
| POST | `/login` | - | ログイン → JWT 発行 |
| GET | `/me` | JWT | ログインユーザー情報 |
| GET | `/users` | JWT+Admin | ユーザー一覧 |

### デザイン抽出 API (`/api/dna`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| POST | `/extract` | JWT+Admin | 単一要素の DNA 抽出 (Puppeteer) |
| POST | `/extract-page` | JWT+Admin | ページ全体の DNA 自動抽出 |
| POST | `/extract-figma` | JWT | Figma ファイルからデザイン抽出 |
| POST | `/extract-figma-paired` | JWT | PC/SP ペアでデザイン抽出 |
| POST | `/figma-structure` | JWT | Figma ファイルのページ・ノード構造取得 |
| GET | `/library` | JWT | 保存済みデザイン一覧 |
| GET | `/latest` | JWT | 最新デザイン取得 |
| GET | `/:id` | JWT | ID 指定デザイン取得 |
| PATCH | `/:id/name` | JWT | デザイン名変更 |
| PATCH | `/:id/type` | JWT | デザインタイプ変更 (web/graphic) |
| PATCH | `/:id/locked-parts` | JWT | ロックパーツ更新 |
| PATCH | `/:id/device-frames` | JWT | デバイスフレーム更新 |
| PATCH | `/:id/page-structure` | JWT | ページ構造保存 |
| POST | `/:id/capture-master` | JWT | マスター画像キャプチャ |
| POST | `/save-generated` | JWT | 生成コードを保存 |
| POST | `/bulk-delete` | JWT | 一括削除 |
| DELETE | `/:id` | JWT | 個別削除 |

### Figma 連携 API (`/api/figma`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| POST | `/validate` | JWT | Figma API 接続確認 |
| POST | `/preview` | JWT | デザイン → スタイルプレビュー |
| POST | `/plugin-styles` | JWT (CORS open) | Plugin 用スタイルデータ |

### エクスポート API (`/api/export`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| POST | `/refactor` | JWT | AI でデザイン → React+Tailwind 変換 |
| POST | `/refactor-elements` | JWT | 要素単位の AI 変換 |
| POST | `/tailwind-config` | JWT | デザイン → tailwind.config.js 生成 |
| GET | `/templates` | JWT | マスターテンプレート一覧 |
| POST | `/register-template` | JWT+Admin | テンプレート登録 |
| PATCH | `/templates/:id/name` | JWT | テンプレート名変更 |
| DELETE | `/templates/:id` | JWT+Admin | テンプレート削除 |
| POST | `/apply-template` | JWT | テンプレートを別デザインに適用 |
| POST | `/preview-with-dna` | JWT | テンプレートをデザインカラーで動的プレビュー |
| POST | `/generate-subpage` | JWT | 下層ページ生成 |
| POST | `/generate-section` | JWT | セクション単体生成 |
| POST | `/assemble-page` | JWT | セクション群をページに結合 |

### ページ制作 API (`/api/compose`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| POST | `/suggest-structure` | JWT | AI がページ名からセクション構成を提案 |
| POST | `/generate-section-composed` | JWT | デザイン参照付きセクション生成 (DNA スタイル強制注入) |
| POST | `/optimize-page` | JWT | 最終最適化 (SEO・アクセシビリティ) |
| POST | `/save-project` | JWT | プロジェクト保存 |
| GET | `/projects` | JWT | プロジェクト一覧 |
| GET | `/projects/:id` | JWT | プロジェクト詳細 |

### アナリティクス API (`/api/analytics`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| GET | `/stats` | JWT | デザインライブラリ・テンプレートの集計データ |

### その他

| Method | Endpoint | 説明 |
|--------|----------|------|
| GET | `/api/health` | ヘルスチェック |
| GET | `/api/images/:filename` | マスター画像の静的配信 |

---

## 7. 既知の課題・未解消事項

### 7.1 アーキテクチャ上の制約

| 課題 | 影響 | 現状の回避策 |
|------|------|------------|
| **Figma Extractor のフラット構造** | `flattenNodes()` が全要素を `children: []` のフラット配列に展開するため、親子の DOM 階層が失われる。`renderLockedPartHtml()` でコンテナ要素 (header, footer 等) を再構築すると空タグになる | Clone+そのまま使用モードではマスター画像 (Figma スクリーンショット) をそのまま表示することで回避。しかしマスター画像がない場合は空白になる可能性がある |
| **JSON ファイルストア** | `data/*.json` にすべて永続化。同時書き込みの競合制御なし。大量データ時のパフォーマンス劣化リスク | 個人開発・小規模利用では問題なし。本格運用時は DB 移行が必要 |
| **AI 出力の非決定性** | 同じプロンプトでも AI の生成結果が毎回異なる。色指定を HEX + style 属性で強制しても、モデルによっては無視される場合がある | `rgbToHex()` 変換 + ネガティブプロンプト + `sanitizeComponentOutput()` 後処理で対応。完全な制御は不可能 |

### 7.2 機能面の未実装・改善余地

| 項目 | 詳細 | 優先度 |
|------|------|--------|
| **Marine Biome (海)** | 3D 環境の海バイオームが未実装 | 低 |
| **DNA → 3D 連動** | 抽出したカラーパレットを 3D 環境に反映する機能が未実装 | 低 |
| **Clone+差し替えモードの精度** | AI がレイアウトを維持しつつテキスト・画像を差し替える精度が不安定。元デザインと大きく異なる出力になることがある | 中 |
| **マスター画像なしのクローン** | Figma Images API でキャプチャされていないデザインの場合、Clone モードが正しく表示されない | 中 |
| **レスポンシブプレビュー** | Step 5 のプレビューは PC 幅固定。SP 幅でのリアルタイムプレビュー切り替えは Step 6 のみ | 低 |
| **プロジェクト編集** | 保存済みプロジェクトの再編集・バージョン管理機能なし | 中 |
| **テスト** | ユニットテスト・E2E テストが未整備 | 高 |

### 7.3 セキュリティ上の注意

| 項目 | 詳細 |
|------|------|
| **API キーのクライアント保存** | AI プロバイダーの API キーは localStorage に base64 エンコードで保存。暗号化ではないため、ブラウザ DevTools で閲覧可能 |
| **JWT シークレット** | `docker-compose.yml` にハードコードされている。本番運用時は `.env` で管理し、強固な値に変更すること |
| **管理者認証情報** | デフォルト `admin@oasis.local / admin123` がソースに含まれる。公開時は変更必須 |
| **Puppeteer URL 抽出** | 任意 URL のスクレイピングが可能 (管理者限定)。SSRF リスクに注意 |

---

## 8. セットアップ

### 8.1 環境変数 (.env)

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
JWT_SECRET=oasis-jwt-secret-change-me
ADMIN_EMAIL=admin@oasis.local
ADMIN_PASSWORD=admin123
DEEPSEEK_API_KEY=              # デフォルト AI プロバイダー
```

各 AI プロバイダーのキーはクライアントの設定画面 (`/settings`) から入力。サーバー側環境変数は DeepSeek のフォールバック用のみ。

### 8.2 Docker 起動

```bash
docker compose up -d --build
```

- Client: http://localhost:3000
- Server: http://localhost:4000

### 8.3 リビルド (vite.config.js 等の変更時)

`vite.config.js` は Docker ボリュームマウント対象外のため、変更時はリビルドが必要:

```bash
docker compose down
docker compose build --no-cache client
docker compose up -d
```

### 8.4 開発時の注意

- **Windows + Docker HMR**: Vite の `watch` に `usePolling: true, interval: 500` が必要 (設定済み)
- **Docker ビルドキャッシュ**: 依存関係の問題が発生したら `docker builder prune -f` を実行
- **Windows パス変換**: Docker exec 時に `MSYS_NO_PATHCONV=1` プレフィックスを使用

---

## 9. 開発用アカウント

| 項目 | 値 |
|------|------|
| メール | `admin@oasis.local` |
| パスワード | `admin123` |

サーバー起動時に自動シードされる。公開時は `.env` で変更すること。

---

## 10. 用語・命名規約

| 用語 | 説明 |
|------|------|
| **デザイン / OASIS** | UI 上・AI プロンプト上で使用する呼称 |
| **DNA** | 内部変数名 (`extractDNA` 等) と API パス (`/api/dna/`) は互換性のため維持 |
| **CSS クラスプレフィックス** | `oasis-` (例: `text-oasis-primary`, `bg-oasis-bg-main`) |
| **Figma スタイル名** | `OASIS/text/...`, `OASIS/bg/...` |
