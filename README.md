# O'Reilly Extension

O'Reilly Learning（learning.oreilly.com）の書籍ページを自動的にPDF化してダウンロードするChrome拡張機能です。

## 機能

- O'Reilly Learningの書籍ページを順番にPDF化
- 複数ページを自動的に処理
- IndexedDBを使用した効率的なデータ保存
- すべてのページを1つのPDFファイルにマージしてダウンロード

## 前提条件

- Node.js 24.11.1以上
- npm 11.6.2以上
- Chromeブラウザ

## インストール

### 1. 依存関係のインストール

```bash
npm install
```

### 2. ビルド

```bash
npm run build
```

これにより `dist` ディレクトリにビルドされた拡張機能が生成されます。

### 3. Chrome拡張機能として読み込む

1. Chromeを開き、`chrome://extensions/` にアクセス
2. 右上の「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. プロジェクトの `dist` ディレクトリを選択

## 使い方

### 基本的な使い方

1. **O'Reilly Learningにアクセス**
   - ChromeでO'Reilly Learning（learning.oreilly.com）にログインします

2. **拡張機能を開く**
   - ブラウザのツールバーから拡張機能のアイコンをクリックしてポップアップを開きます

3. **開始URLを入力**
   - ダウンロードしたい書籍の最初のページのURLを「開始URL」フィールドに入力します
   - 例: `https://learning.oreilly.com/library/view/book-name/...`

4. **取得開始**
   - 「取得開始」ボタンをクリックして処理を開始します
   - 拡張機能が自動的にページを順番に処理し、各ページをPDF化して保存します

5. **処理状況の確認**
   - ステータスエリアで処理の進行状況を確認できます
   - 現在処理中のページ番号が表示されます

6. **処理の停止（必要に応じて）**
   - 処理中に「停止」ボタンをクリックすると処理を中断できます

7. **PDFマージ・ダウンロード**
   - すべてのページの処理が完了したら、「PDFマージ・ダウンロード」ボタンをクリックします
   - 保存されたすべてのPDFページが1つのファイルにマージされ、ダウンロードされます
   - ファイル名は書籍タイトル（URLから自動抽出）とタイムスタンプから生成されます

### 注意事項

- この拡張機能はO'Reilly Learningの書籍ページに対してのみ動作します
- 大量のページを処理する場合、時間がかかる場合があります
- 処理中はブラウザの他の操作を控えてください
- PDFファイルは処理完了後にダウンロードされます
- データはIndexedDBに保存されるため、ブラウザのデータをクリアすると失われます

## 開発

### 開発モード

```bash
npm run dev
```

開発モードでは、変更を監視して自動的にビルドします。

### プロジェクト構造

```
oreilly-extension/
├── src/
│   ├── background/        # バックグラウンドスクリプト（Service Worker）
│   ├── content/           # コンテンツスクリプト
│   ├── popup/             # ポップアップUI
│   ├── lib/               # 共通ライブラリ（IndexedDB管理など）
│   └── manifest.json      # 拡張機能マニフェスト
├── dist/                  # ビルド出力ディレクトリ
└── vite.config.js         # Vite設定
```

## 技術スタック

- Chrome Extension Manifest V3
- Vite（ビルドツール）
- pdf-lib（PDF操作）
- IndexedDB（データ保存）

## ライセンス

ISC

## 作者

otajisan

## リポジトリ

https://github.com/otajisan/oreilly-extension
