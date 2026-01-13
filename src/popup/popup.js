// DOM要素の取得
const startUrlInput = document.getElementById('startUrl');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const btnMerge = document.getElementById('btnMerge');
const statusArea = document.getElementById('statusArea');

// 状態管理
let isRunning = false;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  // 保存されたURLを復元
  await loadSavedUrl();
  
  // バックグラウンドからのステータス更新をリッスン
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'statusUpdate') {
      updateStatus(message.status);
    }
    if (message.type === 'progressUpdate') {
      updateProgress(message.current, message.total);
    }
    if (message.type === 'stopped') {
      handleStopped();
    }
  });

  // ボタンイベントリスナー
  btnStart.addEventListener('click', handleStart);
  btnStop.addEventListener('click', handleStop);
  btnMerge.addEventListener('click', handleMerge);
});

// 保存されたURLを復元
async function loadSavedUrl() {
  try {
    const result = await chrome.storage.local.get(['startUrl']);
    if (result.startUrl) {
      startUrlInput.value = result.startUrl;
    }
  } catch (error) {
    console.error('URLの復元に失敗しました:', error);
  }
}

// URLを保存
async function saveUrl(url) {
  try {
    await chrome.storage.local.set({ startUrl: url });
  } catch (error) {
    console.error('URLの保存に失敗しました:', error);
  }
}

// 開始ボタンのハンドラー
async function handleStart() {
  const url = startUrlInput.value.trim();
  
  if (!url) {
    alert('開始URLを入力してください。');
    return;
  }

  // URLの形式を簡易チェック
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    alert('有効なURLを入力してください。');
    return;
  }

  // URLを保存
  await saveUrl(url);

  // バックグラウンドにメッセージを送信
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'start',
      url: url
    });

    if (response && response.success) {
      isRunning = true;
      updateUIState(true);
      updateStatus('処理を開始しました...');
    } else {
      alert('開始に失敗しました: ' + (response?.error || '不明なエラー'));
    }
  } catch (error) {
    console.error('メッセージ送信エラー:', error);
    alert('バックグラウンドスクリプトとの通信に失敗しました。');
  }
}

// 停止ボタンのハンドラー
async function handleStop() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'stop'
    });

    if (response && response.success) {
      handleStopped();
    } else {
      alert('停止に失敗しました: ' + (response?.error || '不明なエラー'));
    }
  } catch (error) {
    console.error('メッセージ送信エラー:', error);
    alert('バックグラウンドスクリプトとの通信に失敗しました。');
  }
}

// 停止時の処理
function handleStopped() {
  isRunning = false;
  updateUIState(false);
  updateStatus('停止しました。');
}

// UI状態の更新
function updateUIState(running) {
  btnStart.disabled = running;
  btnStop.disabled = !running;
  startUrlInput.disabled = running;
  
  if (running) {
    statusArea.classList.add('active');
  } else {
    statusArea.classList.remove('active');
  }
}

// ステータスの更新
function updateStatus(statusText) {
  const statusTextElement = statusArea.querySelector('.status-text');
  if (statusTextElement) {
    statusTextElement.textContent = statusText;
    statusTextElement.classList.remove('status-idle');
  } else {
    statusArea.innerHTML = `<div class="status-text">${statusText}</div>`;
  }
}

// 進行状況の更新
function updateProgress(current, total) {
  const statusText = `${current}/${total} ページ処理中`;
  updateStatus(statusText);
  
  // 進行状況を表示
  let progressElement = statusArea.querySelector('.status-progress');
  if (!progressElement) {
    progressElement = document.createElement('div');
    progressElement.className = 'status-progress';
    statusArea.appendChild(progressElement);
  }
  progressElement.textContent = statusText;
}

// PDFマージボタンのハンドラー
async function handleMerge() {
  try {
    // ボタンを無効化
    btnMerge.disabled = true;
    updateStatus('PDFマージ処理中...');
    
    // 書籍タイトルを取得（URLから抽出を試みる）
    const url = startUrlInput.value.trim();
    let bookTitle = null;
    
    if (url) {
      try {
        // URLから書籍名を抽出（例: /library/view/book-name/...）
        const match = url.match(/\/library\/view\/([^/]+)/);
        if (match) {
          bookTitle = decodeURIComponent(match[1]).replace(/-/g, ' ');
        }
      } catch (e) {
        // URL解析エラーは無視
      }
    }
    
    const response = await chrome.runtime.sendMessage({
      type: 'MERGE_PDF',
      bookTitle: bookTitle
    });

    if (response && response.success) {
      updateStatus(`PDFダウンロード完了: ${response.fileName || 'merged.pdf'} (${response.pageCount || 0} ページ)`);
    } else {
      alert('PDFマージに失敗しました: ' + (response?.error || '不明なエラー'));
      updateStatus('PDFマージに失敗しました');
    }
  } catch (error) {
    console.error('PDFマージエラー:', error);
    alert('PDFマージ処理中にエラーが発生しました: ' + error.message);
    updateStatus('エラーが発生しました');
  } finally {
    btnMerge.disabled = false;
  }
}
