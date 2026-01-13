// Service Worker for O'Reilly Extension

// 処理状態の管理
let isProcessing = false;
let currentUrl = null;

// メッセージリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'start') {
    handleStart(message.url, sendResponse);
    return true; // 非同期レスポンスのため
  } else if (message.type === 'stop') {
    handleStop(sendResponse);
    return true; // 非同期レスポンスのため
  }
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
    sendResponse({ success: false, error: error.message });
  }
}

// 停止処理
function handleStop(sendResponse) {
  if (!isProcessing) {
    sendResponse({ success: false, error: '処理が実行されていません。' });
    return;
  }

  try {
    isProcessing = false;
    currentUrl = null;
    
    sendResponse({ success: true });
    
    // 停止通知を送信
    sendStatusUpdate('停止しました。');
    sendMessageToPopup({ type: 'stopped' });
    
  } catch (error) {
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
