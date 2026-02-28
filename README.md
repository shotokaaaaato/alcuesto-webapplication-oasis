Oasis (オアシス) - Digital Terrarium for Web DNA
1. プロジェクト概要
Oasis は、既存の Web サイトからデザインの「DNA（スタイル・構造）」を抽出し、3D 空間（デジタル・テラリウム）の中で再構築する、デザイナー・コーダー向け次世代制作プラットフォームです。

単なるコピーではなく、抽出した要素をクリーンなコードへリファクタリングし、Three.js を用いた「非日常的な Web 体験」へと昇華させることで、クリエイティブ制作の付加価値を最大化します。

2. コア機能 (優先順位)
DNA Picker (抽出): マウス選択した要素の computedStyle を JSON 化し、デザインの「苗」として採取。

Oasis 3D Canvas (昇華): Three.js による没入型エディタ。以下のバイオーム（環境）を瞬時に切り替え。

Standard: クリーンな編集モード。

Forest (森): 木漏れ日、揺れる葉、パーティクル演出。

Marine (海): 水の屈折、泡、魚の遊泳エフェクト。

Figma DNA Sync (連携): 抽出 DNA を Figma API 経由で Figma の Styles/Variables へ自動生成。

Semantic Exporter (変換): AI による Tailwind CSS / BEM 形式へのクリーンなコード変換。

3. 技術スタック
Frontend: React, Three.js (React Three Fiber), Tailwind CSS

Backend: Node.js (Express), Puppeteer, Prisma (SQLite)

AI/API: Claude API (Refactoring), Figma API

Infrastructure: Docker, VPS (Ubuntu), Nginx

4. ディレクトリ構造
Plaintext
oasis/
├── README.md           # 本ドキュメント
├── docker-compose.yml  # 開発・本番共通環境
├── server/             # DNA抽出・Figma連携・DB管理
│   └── src/services/dnaExtractor.js  # スタイル解析ロジック
├── client/             # React & Three.js UI
│   └── src/components/Canvas3D.js    # 3D空間制御
└── shared/             # DNAデータ型定義 (JSON Schema)
5. セットアップ・開発手順
5.1 環境構築 (Docker)
oasis ディレクトリへ移動。

.env ファイルを作成し、各種 API キー（Figma, Claude 等）を設定。

以下のコマンドを実行してコンテナを起動。

Bash
docker-compose up -d --build
5.2 開発フロー
Claude Code: バックエンドの DNA 抽出ロジック、Figma API 連携、Docker 構成の最適化に使用。

Cursor: STUDIO ライクな UI のブラッシュアップ、Three.js のビジュアル調整に使用。

6. セキュリティ・法的配慮
抽出したデータからは個人情報やトラッキングコードを自動除去。

プレビューは sandbox 付きの iframe で実行し、安全性を確保。

「複製」ではなく、デザインの「数値をベースにした再構成」に特化することで法的リスクを低減。