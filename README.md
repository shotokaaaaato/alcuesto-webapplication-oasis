# Oasis (オアシス) — Digital Terrarium for Web Design

> **⚠️ サービス終了のお知らせ**
> 本プロジェクトは **2026-03-22** をもって終了しました。別サービスにて展開予定のため、本リポジトリはアーカイブとして残します。

---

## 1. プロジェクト概要

Oasis は、既存の Web サイトや Figma デザインから「デザイン DNA（スタイル・構造）」を抽出し、AI を活用してページを再構築する次世代制作プラットフォームです。

TOP ページには「砂漠のオアシス」をテーマにした没入型 3D インターフェースを採用し、「誰もがこの場所を求めていた。砂漠で潤いを求めるように。」というコンセプトのもと、クリエイティブ制作に潤いと直感的な体験をもたらします。

---

## 2. 技術スタック

| レイヤー | 技術 |
|---------|------|
| Frontend | React 18, Three.js (React Three Fiber + Drei), Tailwind CSS 3, Framer Motion, Monaco Editor |
| Backend | Node.js (Express), Puppeteer (デザイン抽出 + URL スキャン), JSON File Store |
| AI / API | マルチプロバイダー: DeepSeek-V3 (デフォルト), OpenAI GPT-4o, Claude (claude-sonnet-4-20250514), Gemini 2.0 Flash, Perplexity — Figma Plugin API |
| Infrastructure | Docker Compose (client:3000, server:4000) |
| Auth | bcryptjs + jsonwebtoken (JWT 7日間有効) |

---

## 3. プロジェクト構造

```
oasis/
├── README.md
├── docker-compose.yml
├── .env / .env.example
│
├── client/                          # React フロントエンド (port 3000)
│   ├── Dockerfile.dev
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx                 # エントリポイント (BrowserRouter + AuthProvider)
│       ├── App.jsx                  # ルーティング定義 (14ルート)
│       ├── context/
│       │   └── AuthContext.jsx      # 認証状態管理 (user, token, login, register, logout)
│       ├── pages/
│       │   ├── TopPage.jsx          # 3D オアシス + 切り株メニュー
│       │   ├── LoginPage.jsx        # ログイン / 新規登録フォーム
│       │   ├── DashboardPage.jsx    # Bento UI カードグリッド (9カード)
│       │   ├── CanvasPage.jsx       # 3D テラリウム + DNA ツール
│       │   ├── FigmaImportPage.jsx  # Figma インポート (PC/SP ペア対応)
│       │   ├── DnaLibraryPage.jsx   # デザインライブラリ (一覧・検索・プレビュー)
│       │   ├── FigmaGuidePage.jsx   # Figma プラグインガイド
│       │   ├── SemanticExporterPage.jsx  # AI コード変換 + Monaco Editor + プレビュー
│       │   ├── CompositionWizardPage.jsx # ページ構成ウィザード (5ステップ)
│       │   ├── UrlImportPage.jsx    # URL インポート (管理者専用)
│       │   ├── PartsPage.jsx        # テンプレートパーツ管理
│       │   ├── CodeLibraryPage.jsx  # AI生成コード管理
│       │   ├── AnalyticsPage.jsx    # 3D アナリティクス
│       │   └── SettingsPage.jsx     # API キー・Figma トークン管理
│       ├── hooks/
│       │   └── useApiKeys.js        # AIプロバイダー API キー管理 (localStorage base64 / session-only)
│       ├── utils/
│       │   ├── htmlRenderer.js      # クライアントサイド HTML レンダラー + iframe インタラクションスクリプト
│       │   ├── figma.js             # Figma URL 正規表現 + ファイルキー抽出
│       │   └── zipDownloader.js     # ZIP ダウンロードユーティリティ
│       ├── constants/
│       │   ├── roles.js             # セクションロール定数 (ROLES, getRoleColor, getRoleLabel)
│       │   └── placeholders.js      # コードエディタ・プレビュー共通プレースホルダー
│       └── components/
│           ├── Canvas3D.jsx         # React Three Fiber ラッパー
│           ├── DesertBiome.jsx      # 砂漠バイオーム (切り株メニュー対応)
│           ├── ForestBiome.jsx      # 森バイオーム
│           ├── DnaNode.jsx          # DNA 3D ノード表示
│           ├── DnaPicker.jsx        # URL/セレクタ入力 → DNA 抽出
│           ├── FigmaTokenInput.jsx  # Figma Token 入力 + ヘルプモーダル + localStorage 永続化
│           ├── ModelSelector.jsx    # AI モデル選択ドロップダウン (キー検証付き)
│           ├── CircularProgress.jsx # 汎用円形プログレスインジケーター
│           ├── PropertyPanel.jsx    # プロパティ編集パネル
│           ├── SectionReviewModal.jsx # セクション別 AI 生成レビューモーダル
│           └── composition/         # ページ構成ウィザード
│               ├── PageInitModal.jsx           # Step 1: ページ名・モデル・画像モード
│               ├── StructurePlannerPanel.jsx   # Step 2: AI 構成提案 + ドラッグ並べ替え
│               ├── SectionDesignMapper.jsx     # Step 3: デザインマッピング
│               ├── ReferenceConfigPanel.jsx    # Step 3.5: 参照モード詳細設定 (clone keep/replace, AI content mode)
│               ├── DesignPreviewModal.jsx      # デザイン要素選択モーダル (zoom/pan対応)
│               ├── CompositionPreviewPanel.jsx # Step 4: ライブ編集エディタ
│               └── PageOptimizerModal.jsx      # Step 5: 最終最適化
│
├── server/                          # Express バックエンド (port 4000)
│   ├── Dockerfile
│   └── src/
│       ├── index.js                 # サーバーエントリ + ルートマウント (7 API グループ)
│       ├── middleware/
│       │   └── auth.js              # JWT 認証 (verifyToken, requireAdmin)
│       ├── routes/
│       │   ├── auth.js              # /api/auth — register, login, me, users
│       │   ├── dna.js               # /api/dna — extract, extract-figma, library, CRUD
│       │   ├── figma.js             # /api/figma — validate, preview, plugin-styles, plugin-files
│       │   ├── export.js            # /api/export — AI refactor, templates, tailwind-config
│       │   ├── compose.js           # /api/compose — ページ構成ウィザード + ライブ編集 API
│       │   ├── analytics.js         # /api/analytics — デザイン統計データ
│       │   ├── urlImport.js         # /api/url-import — URL スキャン (管理者専用)
│       │   └── sandbox.js           # /api/sandbox — 隔離 AI 生成実験 (未マウント・開発用)
│       ├── models/
│       │   ├── userStore.js         # ユーザー永続化 → data/users.json
│       │   ├── dnaStore.js          # デザイン永続化 → data/dna-library.json
│       │   ├── templateStore.js     # テンプレート永続化 → data/templates.json
│       │   └── compositionStore.js  # 構成プロジェクト永続化 → data/composition-projects.json
│       └── services/
│           ├── aiClientFactory.js   # マルチ AI プロバイダー統一呼出 (callAI)
│           ├── aiRefactorService.js # AI リファクタ + サニタイズ後処理
│           ├── dnaExtractor.js      # Puppeteer による CSS/構造抽出
│           ├── urlScannerService.js # URL マルチビューポートスキャン (SP/Tablet/PC)
│           ├── figmaExtractor.js    # Figma API ノード → DNA 変換
│           ├── figmaService.js      # DNA → Figma スタイル変換 (色/タイポグラフィ)
│           ├── tailwindConfigGenerator.js  # DNA → tailwind.config.js 生成
│           └── templateHasher.js    # DNA ハッシュ + カラーマップ抽出 + カラー置換
│
├── apps/
│   └── figma-sync/
│       └── plugin/                  # Figma Plugin (Figma デスクトップ内で実行)
│           ├── manifest.json
│           ├── code.js              # createPaintStyle / createTextStyle
│           └── ui.html              # Plugin UI (ES5互換・サーバーからデータ取得→同期)
│
└── shared/
    └── dnaSchema.json               # Web DNA JSON Schema 定義
```

---

## 4. ページ・ルーティング

| パス | ページ | 認証 | 説明 |
|------|--------|------|------|
| `/` | TopPage | Public | 3D オアシス + 切り株メニュー (ログイン/登録/About) |
| `/login` | LoginPage | Public | ログイン / 新規登録フォーム |
| `/dashboard` | DashboardPage | Protected | Bento UI カードグリッド (9機能へのハブ) |
| `/canvas` | CanvasPage | Protected | 3D テラリウム + DNA ピッカー + プロパティパネル |
| `/figma-import` | FigmaImportPage | Protected | Figma からデザイン構造を抽出 (PC/SP ペア対応) |
| `/figma-guide` | FigmaGuidePage | Protected | Figma プラグインの使い方ガイド |
| `/export` | SemanticExporterPage | Protected | AI リファクタ + Monaco Editor + ライブプレビュー |
| `/library` | DnaLibraryPage | Protected | デザインライブラリ管理・検索・動的プレビュー |
| `/compose` | CompositionWizardPage | Protected | ページ構成ウィザード + ライブ編集エディタ |
| `/url-import` | UrlImportPage | Protected (Admin) | URL からページ解析 (3ビューポート) |
| `/parts` | PartsPage | Protected | テンプレートパーツ管理 |
| `/code-library` | CodeLibraryPage | Protected | AI 生成コード管理 |
| `/analytics` | AnalyticsPage | Protected | 3D デザイン傾向分析 |
| `/settings` | SettingsPage | Protected | AI APIキー・Figma トークン管理 |

---

## 5. コア機能

### 5.1 3D Biomes (環境モード)
- **Standard (Oasis)**: 砂漠のオアシス。ヤシの木と泉、キャンピングカー。切り株がメニューボタンとして機能
- **Forest (森)**: 翡翠色のガラス質感、木漏れ日、舞い落ちる葉
- **Marine (海)**: 未実装
- **DNA 連動**: 抽出した DNA カラーパレットを 3D 環境に反映する機能は開発中

### 5.2 デザイン抽出

**Figma 抽出** (全ユーザー — `/figma-import`):
- Figma Access Token + File URL → ページ/フレーム一覧 → ノード選択 → 要素抽出
- Web デザイン: PC/SP ペア抽出 (`extract-figma-paired`) + デバイスフレーム管理
- Graphic デザイン: 単一フレーム抽出
- マスター画像の自動ダウンロード
- `figd_` プレフィックスバリデーション + 6ステップ取得ガイドモーダル

**URL 抽出** (管理者のみ — `/url-import`):
- Puppeteer で 3 ビューポート (SP:375px / Tablet:768px / PC:1440px) を並列スキャン
- 各ビューポートのマスター画像キャプチャ
- デバイスフレームとして保存 (PC + SP ペア)
- 著作権同意チェックボックス実装済み

### 5.3 ページ構成ウィザード (CompositionWizard)

デザインライブラリから参照デザインを選び、AI でインタラクティブにページを構成する 5 ステップウィザード。

| Step | コンポーネント | 内容 |
|------|-------------|------|
| 1 | PageInitModal | ページ名・AI モデル・画像モード選択 |
| 2 | StructurePlannerPanel | AI がセクション構成を提案 (ドラッグ並べ替え対応) |
| 3 | SectionDesignMapper + ReferenceConfigPanel | デザインマッピング + 参照モード詳細設定 |
| 4 | CompositionPreviewPanel | ライブ編集エディタ (テキスト/画像編集) |
| 5 | PageOptimizerModal | AI がセクション間の余白・配色を統一し最終 HTML 生成 |

**セクションモード:**
- **Clone (完全再現)**: `renderCloneSection()` で HTML 直接構築。AI 不要。keep/replace 選択可
- **Reference (参照)**: AI がデザイン DNA のスタイルを継承して新セクション生成
- **None (参照なし)**: ベースカラー・フォントのみ継承して AI がゼロから生成

**ライブ編集機能:**
- マスター画像 + 要素オーバーレイの即時レンダリング (`htmlRenderer.js`)
- ホバーで青枠 → クリックで紫枠選択 → フローティングメニュー
- テキスト: AI 書き換え / 直接編集 (contentEditable) / 削除
- 画像: AI 画像提案 (Unsplash) / 手動アップロード
- 編集済みセクションをデザインライブラリに即時保存可能

**ライブ編集の「再現」の仕組みと制限:**
- **マスター画像あり**: 背景に画像を表示 + 透明オーバーレイで編集可能に。デザインは崩れない
- **マスター画像なし**: DNA の boundingBox・スタイルから HTML+CSS で再構築。ずれや崩れの可能性あり

### 5.4 Semantic Exporter
- **AI リファクタ**: DNA → React + Tailwind コンポーネント変換 (マルチ AI 対応)
- **ハッシュキャッシュ**: SHA-256 で同一 DNA 構成はキャッシュから返却
- **テンプレートシステム**: マスターテンプレート登録 → 他の DNA に色置換で適用
- **Tailwind Config 生成**: DNA → `theme.extend` 形式
- **プレビュー UI**: 左=Monaco Editor、右=iframe + Tailwind CDN Play
- **エクスポート**: クリップボードコピー / .jsx / tailwind.config.js ダウンロード

### 5.5 デザインライブラリ (DnaLibraryPage)
- カードグリッド + カテゴリフィルタ (ヘッダー/FV/セクション/フッター/ナビ/カード)
- ソースフィルタ (Figma / URL)、テキスト検索
- DNA 動的プレビュー: 選択テンプレートを現在の DNA カラーで即時レンダリング
- カラースウォッチ表示
- 双方向エクスポート: コードコピー / Figma 送信

### 5.6 Figma Sync (Plugin)
- **Plugin**: `apps/figma-sync/plugin/` — サーバーから取得した DNA で Local Styles を自動作成・更新
- **スタイル名**: `OASIS/text/...`, `OASIS/bg/...`
- **重複処理**: 既存スタイル名一致で更新 (新規作成しない)
- **フォント**: 指定スタイル → Regular → Inter Regular の3段階フォールバック
- **ES5互換**: Plugin UI は async/await/spread 構文禁止
- **Figma Pro プラン対応**: Variables API ではなく Local Styles を使用

### 5.7 AI サニタイズシステム

AI コード出力の品質保証を二重構造で実施:

**A. システムプロンプト (4大洗浄ルール)**:
1. トラッキングコード全除去 (GA, GTM, Facebook Pixel, Hotjar)
2. サイト固有ID削除 (CMS固有クラス: wp-block-*, elementor-*, framer-*)
3. DNA変数置換 (HEX → セマンティッククラス: text-oasis-primary, bg-oasis-bg-main)
4. 汎用React出力 (環境非依存、Props差替可能)

**B. コーディング規約**:
- カスタムクラスは snake_case (ハイフン禁止)
- ブラウザ標準 (16px = 1rem) 尊重、62.5% ハック禁止
- モバイルファースト + 370px 最小幅対応
- absolute 配置禁止 → flex/grid でレイアウト構成

**C. プログラム後処理 (`sanitizeComponentOutput`)**:
- トラッキングスクリプト/属性の正規表現除去 (15パターン)
- id 属性の全除去
- CMS固有クラスの除去 (6パターン)
- `position: absolute` 排除 + Tailwind `absolute` → `relative` 置換
- 座標指定クラス除去、空 className 除去

### 5.8 3D アナリティクス
- フォントサイズ分布 (3D 棒グラフ)
- カラー使用マップ
- レイアウト統計 (flex/grid/block 分布)
- タイポグラフィ quirks 検出
- Three.js によるインタラクティブ 3D レンダリング

### 5.9 認証システム
- JWT ベース (7日間有効)
- bcryptjs でパスワードハッシュ化
- 管理者アカウントはサーバー起動時に自動シード
- ProtectedRoute で認証必須ページを保護

---

## 6. マルチ AI プロバイダーシステム

**統一呼出関数**: `callAI(systemPrompt, userMessage, { provider, apiKey, maxTokens })` (`aiClientFactory.js`)

| プロバイダー | モデル | タイプ | 備考 |
|-------------|--------|--------|------|
| DeepSeek | deepseek-chat | OpenAI互換 | デフォルト・コスト最適化 |
| OpenAI | gpt-4o | OpenAI互換 | |
| Claude | claude-sonnet-4-20250514 | Anthropic SDK | |
| Gemini | gemini-2.0-flash | Google AI SDK | |
| Perplexity | llama-3.1-sonar-large-128k-online | OpenAI互換 | |

- **クライアント**: `useApiKeys.js` で localStorage (base64) or session-only 管理
- **UI**: `ModelSelector.jsx` でキー検証付きドロップダウン
- **セキュリティ**: キーはサーバー非保存。リクエスト body で都度送信。env var フォールバック (DeepSeek のみ)

---

## 7. API エンドポイント一覧

### 認証 API (`/api/auth`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| GET | `/api/health` | - | ヘルスチェック |
| POST | `/api/auth/register` | - | ユーザー登録 |
| POST | `/api/auth/login` | - | ログイン → JWT 発行 |
| GET | `/api/auth/me` | JWT | ログインユーザー情報 |
| GET | `/api/auth/users` | JWT+Admin | ユーザー一覧 |

### デザイン管理 API (`/api/dna`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| POST | `/api/dna/extract` | JWT+Admin | 単一要素の DNA 抽出 (Puppeteer) |
| POST | `/api/dna/extract-page` | JWT+Admin | ページ全体の DNA 自動抽出 |
| POST | `/api/dna/extract-figma` | JWT | Figma ファイルからデザイン抽出 |
| POST | `/api/dna/extract-figma-paired` | JWT | Figma PC/SP ペア抽出 (Web デザイン用) |
| POST | `/api/dna/figma-structure` | JWT | Figma ファイルのページ・ノード構造取得 |
| GET | `/api/dna/library` | JWT | 保存済みデザイン一覧 |
| GET | `/api/dna/latest` | JWT | 最新デザイン取得 |
| GET | `/api/dna/:id` | JWT | ID 指定デザイン取得 |
| PATCH | `/api/dna/:id/name` | JWT | デザイン名更新 |
| PATCH | `/api/dna/:id/type` | JWT | タイプ変更 (web/graphic) |
| PATCH | `/api/dna/:id/locked-parts` | JWT | ロック要素設定 |
| PATCH | `/api/dna/:id/device-frames` | JWT | デバイスフレーム更新 |
| PATCH | `/api/dna/:id/page-structure` | JWT | ページ構造保存 (リージョン + ロール) |
| POST | `/api/dna/:id/capture-master` | JWT | マスター画像再ダウンロード |
| DELETE | `/api/dna/:id` | JWT | デザイン削除 |
| POST | `/api/dna/bulk-delete` | JWT | 一括削除 |
| POST | `/api/dna/save-generated` | JWT | 生成ページをライブラリに保存 |

### Figma 連携 API (`/api/figma`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| POST | `/api/figma/validate` | JWT | Figma API 接続確認 |
| POST | `/api/figma/preview` | JWT | DNA → スタイルプレビュー |
| POST | `/api/figma/plugin-styles` | JWT (CORS open) | Plugin 用スタイルデータ |
| POST | `/api/figma/images` | JWT | Figma フレームサムネイル取得 |
| GET | `/api/figma/plugin-files` | - | Plugin ファイルダウンロード (manifest/code/ui) |

### エクスポート API (`/api/export`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| POST | `/api/export/refactor` | JWT | AI で DNA → React+Tailwind 変換 |
| POST | `/api/export/refactor-elements` | JWT | 要素配列を直接リファクタ |
| POST | `/api/export/tailwind-config` | JWT | DNA → tailwind.config.js 生成 |
| GET | `/api/export/templates` | JWT | テンプレート一覧 (?full=true でコード含む) |
| POST | `/api/export/register-template` | JWT+Admin | テンプレート登録 |
| DELETE | `/api/export/templates/:id` | JWT+Admin | テンプレート登録解除 |
| PATCH | `/api/export/templates/:id/name` | JWT | テンプレート名更新 |
| POST | `/api/export/apply-template` | JWT | テンプレートを別 DNA に適用 (カラー置換) |
| POST | `/api/export/preview-with-dna` | JWT | 現在の DNA カラーで動的プレビュー |
| POST | `/api/export/generate-subpage` | JWT | フルサブページ生成 (header + main + footer) |
| POST | `/api/export/generate-section` | JWT | 単一セクション生成 (clone or AI) |
| POST | `/api/export/assemble-page` | JWT | セクション結合 + header/footer |

### ページ構成ウィザード API (`/api/compose`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| POST | `/api/compose/suggest-structure` | JWT | AI がページ名からセクション構成を提案 |
| POST | `/api/compose/generate-section-composed` | JWT | デザイン参照ベースのセクション生成 |
| POST | `/api/compose/clone-replace-section` | JWT | 完全再現 + テキスト入替 |
| POST | `/api/compose/generate-fresh-section` | JWT | 参照なしセクションを AI 生成 |
| POST | `/api/compose/rewrite-element` | JWT | テキスト要素を AI で書き換え |
| POST | `/api/compose/suggest-image` | JWT | AI が Unsplash 画像 URL を提案 |
| POST | `/api/compose/upload-image` | JWT | 画像アップロード (base64 → /api/images/) |
| POST | `/api/compose/save-section-to-library` | JWT | セクションをデザインライブラリに保存 |
| POST | `/api/compose/optimize-page` | JWT | セクション間の余白・配色を AI で最適化 |
| POST | `/api/compose/save-project` | JWT | プロジェクト永続化 |
| GET | `/api/compose/projects` | JWT | プロジェクト一覧 |
| GET | `/api/compose/projects/:id` | JWT | プロジェクト詳細 |

### URL インポート API (`/api/url-import`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| POST | `/api/url-import/scan` | JWT+Admin | URL を 3 ビューポートでスキャン |
| POST | `/api/url-import/save` | JWT+Admin | スキャン結果をデザインとして保存 |
| POST | `/api/url-import/save-device` | JWT+Admin | 増分デバイス保存 |

### アナリティクス API (`/api/analytics`)

| Method | Endpoint | 認証 | 説明 |
|--------|----------|------|------|
| GET | `/api/analytics/stats` | JWT | デザイン統計データ (フォント, 色, レイアウト分布) |

---

## 8. データ永続化

| ファイル | 内容 |
|---------|------|
| `server/data/users.json` | ユーザーアカウント + ハッシュパスワード |
| `server/data/dna-library.json` | 抽出デザイン + メタデータ |
| `server/data/templates.json` | 登録テンプレート + コンポーネントコード |
| `server/data/composition-projects.json` | ページ構成プロジェクト |
| `server/data/images/` | マスター画像 + スクリーンショット |

### デザインデータ構造
```javascript
{
  id, url, userId,
  name, type: "web" | "graphic",
  elements: [{
    tagName, selector, textContent, outerHTML,
    styles: { visual: {}, layout: {}, typography: {} },
    boundingBox: { x, y, width, height },
    children: [],
    figmaNodeId, figmaNodeName
  }],
  masterImage: { filename, url, width, height, scale },
  deviceFrames: { pc: {...}, sp: {...} },      // Web デザインのみ
  pageStructure: { parts: [...], savedAt },
  lockedParts: [...],
  bodyBackground: { backgroundColor, backgroundImage },
  createdAt, updatedAt
}
```

---

## 9. セットアップ

### 9.1 環境変数 (.env)

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:3000
JWT_SECRET=oasis-jwt-secret-change-me
ADMIN_EMAIL=admin@oasis.local
ADMIN_PASSWORD=admin123
deepseek_API_KEY=              # DeepSeek API キー (デフォルト AI)
FIGMA_ACCESS_TOKEN=            # Figma Sync 用 (オプション)
```

### 9.2 Docker 起動

```bash
docker compose up -d --build
```

- Client: http://localhost:3000
- Server: http://localhost:4000

### 9.3 リビルド (設定変更時)

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

### 9.4 開発時の注意

- **Docker HMR (Windows)**: `vite.config.js` に `watch: { usePolling: true, interval: 500 }` 必要
- **vite.config.js は volume マウント外**: 変更時は `docker compose build --no-cache client` が必要
- **Windows Docker exec**: `MSYS_NO_PATHCONV=1` プレフィックスが必要な場合あり

---

## 10. 開発アカウント

| 項目 | 値 |
|------|-----|
| メール | `admin@oasis.local` |
| パスワード | `admin123` |

サーバー起動時に自動シード。リポジトリ公開時は `.env` に移行すること。

---

## 11. 未実装・開発中

- **Marine バイオーム** (3D 海洋環境)
- **DNA 連動 3D**: 抽出カラーパレットを 3D 環境に反映
- **リアルタイムコラボレーション**
- **Sandbox API** (`/api/sandbox`): 隔離 AI 生成実験ルート (ファイル存在するが未マウント)
