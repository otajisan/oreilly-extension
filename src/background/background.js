// Service Worker for O'Reilly Extension
import { savePage, getAllPagesSorted, clearAllData } from '../lib/db.js';
import { PDFDocument } from 'pdf-lib';
// メッセージハンドリングとページ遷移制御

// 処理状態の管理
let isProcessing = false;
let currentUrl = null;
let currentPageNumber = 0;

// メッセージタイプ定数
const MESSAGE_TYPES = {
  START: 'start',
  STOP: 'stop',
  PDF_DATA: 'pdfData',
  NEXT_PAGE_REQUEST: 'NEXT_PAGE_REQUEST',
  PAGE_READY: 'PAGE_READY',
  NO_MORE_PAGES: 'NO_MORE_PAGES',
  GENERATE_PDF: 'GENERATE_PDF',
  MERGE_PDF: 'MERGE_PDF'
};

// メッセージハンドラー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] メッセージを受信しました:', message);
  
  // 後方互換性のため、文字列リテラルと定数の両方に対応
  if (message.type === MESSAGE_TYPES.START || message.type === 'start') {
    handleStart(message.url, sendResponse);
    return true; // 非同期レスポンスのため
  }
  
  if (message.type === MESSAGE_TYPES.STOP || message.type === 'stop') {
    handleStop(sendResponse);
    return true; // 非同期レスポンスのため
  }
  
  if (message.type === MESSAGE_TYPES.PDF_DATA || message.type === 'pdfData') {
    // Issue #4のPDF生成ロジックから送信されるPDFデータを受け取る
    handlePdfData(message.pageNumber, message.data, sendResponse);
    return true; // 非同期レスポンスのため
  }
  
  if (message.type === MESSAGE_TYPES.PAGE_READY) {
    console.log('[Background] PAGE_READYを受信しました:', message.url);
    // ページ準備完了時の処理（必要に応じて追加）
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === MESSAGE_TYPES.GENERATE_PDF) {
    console.log('[Background] PDF生成リクエストを受信しました');
    (async () => {
      try {
        const result = await generatePDF(message.tabId || sender.tab?.id);
        
        // Issue #5: PDFデータをIndexedDBに保存
        if (result.success && result.data) {
          const pageNumber = message.pageNumber || currentPageNumber + 1;
          try {
            await savePage(pageNumber, result.data);
            // メモリを解放
            result.data = null;
            currentPageNumber = pageNumber;
            console.log(`[Background] ページ ${pageNumber} をIndexedDBに保存しました`);
          } catch (saveError) {
            console.error('[Background] IndexedDBへの保存エラー:', saveError);
            // 保存エラーが発生してもPDF生成は成功として扱う
          }
        }
        
        sendResponse(result);
      } catch (error) {
        console.error('[Background] PDF生成エラー:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // 非同期処理のためtrueを返す
  }
  
  if (message.type === MESSAGE_TYPES.MERGE_PDF) {
    console.log('[Background] PDFマージリクエストを受信しました');
    (async () => {
      try {
        const result = await mergeAndDownloadPDF(message.bookTitle);
        sendResponse(result);
      } catch (error) {
        console.error('[Background] PDFマージエラー:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // 非同期処理のためtrueを返す
  }
  
  // 未処理のメッセージタイプ
  console.warn('[Background] 未処理のメッセージタイプ:', message.type);
  return false;
});

// 開始処理
async function handleStart(url, sendResponse) {
  if (isProcessing) {
    sendResponse({ success: false, error: '既に処理が実行中です。' });
    return;
  }

  try {
    isProcessing = true;
    currentUrl = url;
    currentPageNumber = 0;
    
    // 既存のデータをクリーンアップ
    await clearAllData();
    console.log('[Background] 既存のデータをクリーンアップしました');
    
    // ここで実際の処理を実装
    // 現時点では基本的な応答のみ
    sendResponse({ success: true });
    
    // ステータス更新を送信
    sendStatusUpdate('処理を開始しました...');
    
    // TODO: 実際のページ取得処理をここに実装
    // 例: processPages(url);
    
  } catch (error) {
    isProcessing = false;
    currentUrl = null;
    currentPageNumber = 0;
    sendResponse({ success: false, error: error.message });
  }
}

// 停止処理
async function handleStop(sendResponse) {
  if (!isProcessing) {
    sendResponse({ success: false, error: '処理が実行されていません。' });
    return;
  }

  try {
    isProcessing = false;
    currentUrl = null;
    currentPageNumber = 0;
    
    // データをクリーンアップ
    await clearAllData();
    console.log('[Background] 停止時にデータをクリーンアップしました');
    
    sendResponse({ success: true });
    
    // 停止通知を送信
    sendStatusUpdate('停止しました。');
    sendMessageToPopup({ type: 'stopped' });
    
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * PDFデータを受け取ってIndexedDBに保存
 * Issue #4のPDF生成ロジックから呼び出される
 * @param {number} pageNumber - ページ番号
 * @param {Uint8Array} pdfData - PDFバイナリデータ
 * @param {function} sendResponse - レスポンス送信関数
 */
async function handlePdfData(pageNumber, pdfData, sendResponse) {
  try {
    if (!pdfData || !(pdfData instanceof Uint8Array)) {
      throw new Error('無効なPDFデータです');
    }
    
    // IndexedDBに保存
    await savePage(pageNumber, pdfData);
    
    // メモリを解放（参照を削除）
    pdfData = null;
    
    console.log(`[Background] ページ ${pageNumber} をIndexedDBに保存しました`);
    
    sendResponse({ success: true, pageNumber });
    
    // 進行状況を更新
    currentPageNumber = pageNumber;
    sendProgressUpdate(pageNumber, 0); // totalは後で更新可能
    
  } catch (error) {
    console.error('[Background] PDFデータの保存エラー:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ステータス更新をpopupに送信
function sendStatusUpdate(status) {
  chrome.runtime.sendMessage({
    type: 'statusUpdate',
    status: status
  }).catch(() => {
    // popupが開いていない場合はエラーを無視
  });
}

// 進行状況更新をpopupに送信
function sendProgressUpdate(current, total) {
  chrome.runtime.sendMessage({
    type: 'progressUpdate',
    current: current,
    total: total
  }).catch(() => {
    // popupが開いていない場合はエラーを無視
  });
}

// popupにメッセージを送信
function sendMessageToPopup(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // popupが開いていない場合はエラーを無視
  });
}

// Content Scriptに次へボタンのクリックをリクエストする関数
async function requestNextPage(tabId) {
  console.log('[Background] 次へページへの遷移をリクエストします (tabId:', tabId, ')');
  
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPES.NEXT_PAGE_REQUEST
    });
    
    if (response && response.type === MESSAGE_TYPES.NO_MORE_PAGES) {
      console.log('[Background] これ以上のページはありません');
      return { success: false, noMorePages: true };
    }
    
    if (response && response.success) {
      console.log('[Background] 次へボタンのクリックに成功しました');
      return { success: true };
    }
    
    console.log('[Background] 次へボタンのクリックに失敗しました');
    return { success: false };
  } catch (error) {
    console.error('[Background] エラー:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Base64文字列をUint8Arrayに変換する
 * @param {string} base64 - Base64エンコードされた文字列
 * @returns {Uint8Array} バイナリデータ
 */
function base64ToUint8Array(base64) {
  // Base64文字列をバイナリ文字列にデコード
  const binaryString = atob(base64);
  // バイナリ文字列をUint8Arrayに変換
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Uint8ArrayをBase64文字列に変換する
 * チャンクごとに処理し、配列にプッシュして最後にjoinすることでO(n)の時間計算量を実現
 * 大きなPDF（50MB+）でも効率的に処理できる
 * @param {Uint8Array} bytes - バイナリデータ
 * @returns {string} Base64エンコードされた文字列
 */
function uint8ArrayToBase64(bytes) {
  const CHUNK_SIZE = 8192; // 8KBチャンク（スタックオーバーフローを防ぐ）
  const len = bytes.byteLength;
  
  // 小さな配列の場合は直接処理
  if (len <= CHUNK_SIZE) {
    try {
      // Array.from()を使わず、直接Uint8Arrayを処理
      const chars = new Array(len);
      for (let i = 0; i < len; i++) {
        chars[i] = bytes[i];
      }
      return btoa(String.fromCharCode.apply(null, chars));
    } catch (e) {
      // スタックオーバーフローの場合はチャンク処理にフォールバック
    }
  }
  
  // 大きな配列の場合はチャンクごとに処理
  // 各チャンクを配列に変換してからString.fromCharCode.applyを使用
  // 配列にプッシュして最後にjoinすることでO(n)の時間計算量を実現
  const chunks = [];
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunkEnd = Math.min(i + CHUNK_SIZE, len);
    const chunk = bytes.subarray(i, chunkEnd);
    const chunkLen = chunk.length;
    
    try {
      // Array.from()を使わず、直接Uint8Arrayを処理
      const chars = new Array(chunkLen);
      for (let j = 0; j < chunkLen; j++) {
        chars[j] = chunk[j];
      }
      chunks.push(String.fromCharCode.apply(null, chars));
    } catch (e) {
      // スタックオーバーフローの場合は、さらに小さなチャンクに分割
      // 小さなチャンク（1KB）に分割して、配列にプッシュして最後にjoin
      const SMALL_CHUNK_SIZE = 1024; // 1KB
      const smallChunks = [];
      for (let j = 0; j < chunkLen; j += SMALL_CHUNK_SIZE) {
        const smallChunkEnd = Math.min(j + SMALL_CHUNK_SIZE, chunkLen);
        const smallChunk = chunk.subarray(j, smallChunkEnd);
        const smallChunkLen = smallChunk.length;
        
        try {
          // Array.from()を使わず、直接Uint8Arrayを処理
          const chars = new Array(smallChunkLen);
          for (let k = 0; k < smallChunkLen; k++) {
            chars[k] = smallChunk[k];
          }
          smallChunks.push(String.fromCharCode.apply(null, chars));
        } catch (e2) {
          // それでもエラーの場合は、さらに小さく分割（256バイト）
          const TINY_CHUNK_SIZE = 256;
          const tinyChunks = [];
          for (let k = 0; k < smallChunkLen; k += TINY_CHUNK_SIZE) {
            const tinyChunkEnd = Math.min(k + TINY_CHUNK_SIZE, smallChunkLen);
            const tinyChunk = smallChunk.subarray(k, tinyChunkEnd);
            const tinyChunkLen = tinyChunk.length;
            
            // Array.from()を使わず、直接Uint8Arrayを処理
            const chars = new Array(tinyChunkLen);
            for (let l = 0; l < tinyChunkLen; l++) {
              chars[l] = tinyChunk[l];
            }
            tinyChunks.push(String.fromCharCode.apply(null, chars));
          }
          smallChunks.push(tinyChunks.join(''));
        }
      }
      chunks.push(smallChunks.join(''));
    }
  }
  
  // すべてのチャンクを結合してBase64エンコード
  return btoa(chunks.join(''));
}

/**
 * 指定したタブのページをPDF化する
 * @param {number} tabId - PDF化するタブのID
 * @returns {Promise<{success: boolean, data?: Uint8Array, error?: string}>}
 */
async function generatePDF(tabId) {
  if (!tabId) {
    throw new Error('タブIDが指定されていません');
  }

  console.log('[Background] PDF生成を開始します (tabId:', tabId, ')');

  try {
    // 1. chrome.debugger.attachでタブにアタッチ
    const debuggee = { tabId: tabId };
    await chrome.debugger.attach(debuggee, '1.0');
    console.log('[Background] Debugger APIにアタッチしました');

    try {
      // 2. Page.printToPDFを呼び出してPDFデータをBase64形式で取得
      // PDF生成オプション: 背景グラフィック：ON、余白：なし
      const pdfResult = await new Promise((resolve, reject) => {
        chrome.debugger.sendCommand(
          debuggee,
          'Page.printToPDF',
          {
            printBackground: true,  // 背景グラフィックの印刷：ON
            marginTop: 0,            // 余白：なし
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            paperWidth: 8.5,         // デフォルトの用紙サイズ（インチ）
            paperHeight: 11
          },
          (result) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(result);
            }
          }
        );
      });

      console.log('[Background] PDF生成に成功しました');

      // 3. Base64データをバイナリ（Uint8Array）に変換
      const pdfData = base64ToUint8Array(pdfResult.data);
      console.log('[Background] PDFデータをUint8Arrayに変換しました (サイズ:', pdfData.length, 'bytes)');

      return {
        success: true,
        data: pdfData
      };
    } finally {
      // デバッガーをデタッチ
      try {
        await chrome.debugger.detach(debuggee);
        console.log('[Background] Debugger APIからデタッチしました');
      } catch (detachError) {
        console.error('[Background] デタッチエラー:', detachError);
      }
    }
  } catch (error) {
    console.error('[Background] PDF生成中にエラーが発生しました:', error);
    throw error;
  }
}

// 外部から呼び出し可能にする（必要に応じて）
// chrome.runtime.onConnect.addListener((port) => {
//   port.onMessage.addListener((message) => {
//     if (message.action === 'nextPage') {
//       requestNextPage(message.tabId).then((result) => {
//         port.postMessage(result);
//       });
//     }
//   });
// });

/**
 * IndexedDBに保存されたPDFページをマージしてダウンロード
 * Issue #6: pdf-libを使用したPDFマージとダウンロード
 * @param {string} bookTitle - 書籍タイトル（オプション）
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function mergeAndDownloadPDF(bookTitle = null) {
  try {
    console.log('[Background] PDFマージ処理を開始します');
    
    // IndexedDBから全ページを取得
    const pages = await getAllPagesSorted();
    
    if (pages.length === 0) {
      throw new Error('マージするPDFページがありません');
    }
    
    console.log(`[Background] ${pages.length} ページを取得しました`);
    sendStatusUpdate(`PDFマージ中... (${pages.length} ページ)`);
    
    // 新しいPDFドキュメントを作成
    const mergedPdf = await PDFDocument.create();
    
    // 各ページを順番にマージ
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      console.log(`[Background] ページ ${page.pageNumber} をマージ中...`);
      
      try {
        // PDFドキュメントを読み込む
        const pdfDoc = await PDFDocument.load(page.data);
        
        // 全ページをコピー
        const pageIndices = pdfDoc.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices);
        
        // コピーしたページを追加
        copiedPages.forEach((copiedPage) => {
          mergedPdf.addPage(copiedPage);
        });
        
        // メモリを解放
        page.data = null;
      } catch (pageError) {
        console.error(`[Background] ページ ${page.pageNumber} のマージエラー:`, pageError);
        // エラーが発生しても続行
      }
    }
    
    // PDFをバイナリに変換
    console.log('[Background] PDFをバイナリに変換中...');
    const pdfBytes = await mergedPdf.save();
    console.log(`[Background] マージ完了 (サイズ: ${pdfBytes.length} bytes)`);
    
    // ファイル名を生成
    const fileName = generateFileName(bookTitle);
    
    // Base64エンコードしてデータURLを作成
    const base64String = uint8ArrayToBase64(pdfBytes);
    const dataUrl = `data:application/pdf;base64,${base64String}`;
    
    // ダウンロード
    try {
      await chrome.downloads.download({
        url: dataUrl,
        filename: fileName,
        saveAs: true
      });
      
      console.log(`[Background] PDFをダウンロードしました: ${fileName}`);
      sendStatusUpdate(`PDFダウンロード完了: ${fileName}`);
      
      return { success: true, fileName: fileName, pageCount: pages.length };
    } catch (downloadError) {
      throw new Error(`ダウンロードに失敗しました: ${downloadError.message}`);
    }
    
  } catch (error) {
    console.error('[Background] PDFマージエラー:', error);
    sendStatusUpdate(`エラー: ${error.message}`);
    throw error;
  }
}

/**
 * ファイル名を生成
 * @param {string} bookTitle - 書籍タイトル（オプション）
 * @returns {string} ファイル名
 */
function generateFileName(bookTitle = null) {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  let fileName = 'oreilly-book';
  
  if (bookTitle) {
    // ファイル名に使用できない文字を置換
    const sanitizedTitle = bookTitle
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 50); // 長すぎる場合は切り詰め
    fileName = sanitizedTitle;
  }
  
  return `${fileName}_${dateStr}.pdf`;
}

console.log('[Background] Service Workerが起動しました');
