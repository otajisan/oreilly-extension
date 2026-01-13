# Cursor設定ファイル

このディレクトリには、CursorのAIエージェントがプロジェクトを理解するための補助ファイルが含まれます。

## ファイル説明

### `.cursorrules`
プロジェクト固有のルールとガイドライン。CursorのAIエージェントがコード生成・修正時に従うべき規約を定義。

### `.cursorignore`
CursorのAIエージェントが無視すべきファイル・ディレクトリのリスト。インデックス作成やコンテキスト理解から除外される。

## プロジェクトの主要な設計パターン

### メッセージングアーキテクチャ

この拡張機能は、Chrome ExtensionのメッセージングAPIを使用してコンポーネント間で通信します:

- **Popup ↔ Background**: ユーザー操作と状態管理
- **Background ↔ Content Script**: ページ操作の制御
- **Background**: PDF生成とデータ管理の中核

### 非同期処理パターン

すべての非同期処理は`async/await`を使用:
- Service Workerのメッセージハンドラー
- IndexedDB操作
- PDF生成・マージ処理
- Chrome API呼び出し

### 状態管理

- グローバル状態は`background.js`で管理（`isProcessing`, `currentUrl`, `currentPageNumber`）
- UI状態は`popup.js`で管理
- 永続データはIndexedDBに保存

### エラー処理

- すべての非同期操作で`try-catch`を使用
- ユーザー向けエラーメッセージは日本語
- 開発者向けログにはコンポーネント名プレフィックス付き
