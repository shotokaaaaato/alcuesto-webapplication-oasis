# OASIS プロジェクト — 重複・不整合 精査レポート

実施日: 2025-02-28

---

## クリーンアップ完了記録（対応済み）

以下の対応を実施し、精査項目は解消済みです。

| 対応内容 | 実施内容 |
|----------|----------|
| **不要ファイル削除 (4件)** | DnaExtractPage.jsx, FigmaSyncPage.jsx, AdminSandbox.jsx, PageComposerModal.jsx を削除（ルート未登録・未 import のため） |
| **Figma URL 正規表現の集約** | `client/src/utils/figma.js` に FIGMA_URL_REGEX + extractFigmaFileKey() を一本化。FigmaImportPage.jsx を共通 import に変更 |
| **プレースホルダー定数の集約** | `client/src/constants/placeholders.js` に PLACEHOLDER_CODE / PLACEHOLDER_PREVIEW を一本化。CodeLibraryPage.jsx と SemanticExporterPage.jsx を共通 import に変更 |
| **README 更新** | 削除したファイルを構造図から除去。utils/figma.js と constants/placeholders.js を追加。セクション 5.2 / 5.8 / 8.1 を実装と整合するよう修正 |

---

## 1. ルーティングと README の不整合（対応済み）

### 1.1 実装 (App.jsx) と README の差異

| 項目 | README の記載 | 実際の実装 (App.jsx) |
|------|----------------|----------------------|
| DNA 抽出 | `/dna` → DnaExtractPage | **ルートなし**。ダッシュボード「Figma インポート」は `/figma-import` → FigmaImportPage |
| Figma 連携 | `/figma-sync` → FigmaSyncPage | **ルートなし** |
| その他 | — | `/figma-import` (FigmaImportPage)、`/figma-guide` (FigmaGuidePage) が存在 |

**結論**: README の「4. ページ・ルーティング」は実装と一致していない。実際に使われているのは FigmaImportPage（/figma-import）であり、DnaExtractPage・FigmaSyncPage はルートに未登録。

---

## 2. 未使用・オーファンファイル（対応済み：削除）

以下のファイルは **削除済み** です。

| ファイル | 理由 |
|----------|------|
| `client/src/pages/DnaExtractPage.jsx` | App.jsx にルート未登録・どこからも import されていない |
| `client/src/pages/FigmaSyncPage.jsx` | 同上 |
| `client/src/pages/AdminSandbox.jsx` | 同上 |
| `client/src/components/PageComposerModal.jsx` | どこからも import されていないコンポーネント |

---

## 3. 重複コード・定数

### 3.1 Figma URL 正規表現（対応済み）

**対応**: `client/src/utils/figma.js` に `FIGMA_URL_REGEX` と `extractFigmaFileKey()` を一本化。FigmaImportPage.jsx を共通 import に変更。DnaExtractPage / FigmaSyncPage 削除に伴い重複解消。

### 3.2 プレースホルダーコード・プレビュー（対応済み）

**対応**: `client/src/constants/placeholders.js` に PLACEHOLDER_CODE / PLACEHOLDER_PREVIEW を一本化。CodeLibraryPage.jsx と SemanticExporterPage.jsx を共通 import に変更。

### 3.3 iframe の sandbox 属性

`sandbox="allow-scripts"` または `allow-scripts allow-same-origin` が複数ページで同様に指定されている（CompositionPreviewPanel, SectionReviewModal, DnaExtractPage, PartsPage, CodeLibraryPage, SemanticExporterPage, DnaLibraryPage, PageOptimizerModal 等）。  
共通コンポーネント（例: `PreviewIframe`）にまとめると一貫性・保守性が上がる。

---

## 4. README の記述ミス・古い記述（対応済み）

削除ファイルを構造図から除去し、utils/figma.js と constants/placeholders.js を追加。セクション 5.2 / 5.8 / 8.1 を実装と整合するよう修正済み。

---

## 5. まとめと推奨アクション

| 優先度 | 内容 | 状態 |
|--------|------|------|
| 高 | README の「4. ページ・ルーティング」「5.3 Bento Dashboard」「8.1」を実装に合わせて修正 | 対応済み |
| 高 | DnaExtractPage / FigmaSyncPage / AdminSandbox / PageComposerModal の廃止（削除） | 対応済み |
| 中 | Figma URL 正規表現を utils/figma.js に集約 | 対応済み |
| 中 | プレースホルダー文字列を constants/placeholders.js に集約 | 対応済み |
| 低 | プレビュー用 iframe を共通コンポーネント化（任意） | 未実施 |

---

*本レポートはソースコードと README の差分に基づく精査結果です。クリーンアップ完了により上記の多くは対応済みです。*
