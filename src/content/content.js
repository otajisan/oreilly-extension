// Content Script for O'Reilly Extension
// DOMクレンジングとページ遷移制御

// メッセージタイプ定数
const MESSAGE_TYPES = {
  NEXT_PAGE_REQUEST: 'NEXT_PAGE_REQUEST',
  PAGE_READY: 'PAGE_READY',
  NO_MORE_PAGES: 'NO_MORE_PAGES'
};

// スリープ関数（async/await用）
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 印刷用スタイルの注入
function injectPrintStyles() {
  console.log('[ContentScript] 印刷用スタイルを注入中...');
  
  const styleId = 'oreilly-print-styles';
  // 既存のスタイルがあれば削除
  const existingStyle = document.getElementById(styleId);
  if (existingStyle) {
    existingStyle.remove();
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @media print {
      /* ヘッダー非表示 */
      #orm-global-site-header {
        display: none !important;
      }
      
      /* サイドバー非表示 */
      section[class*="iconMenu"],
      aside {
        display: none !important;
      }
      
      /* フッター非表示 */
      #content-navigation {
        display: none !important;
      }
      
      /* コントロール非表示 */
      section[class*="iconMenu"] {
        display: none !important;
      }
      
      /* 本文領域の調整 */
      main,
      #content-panel {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    }
  `;
  
  document.head.appendChild(style);
  console.log('[ContentScript] 印刷用スタイルの注入が完了しました');
}

// 次へボタンを探してクリック
async function clickNextButton() {
  console.log('[ContentScript] 次へボタンを検索中...');
  
  // 部分一致セレクタを使用
  const nextButton = document.querySelector('a[class*="nextContainer"]');
  
  if (!nextButton) {
    console.log('[ContentScript] 次へボタンが見つかりませんでした');
    return false;
  }
  
  console.log('[ContentScript] 次へボタンが見つかりました。クリックします...');
  nextButton.click();
  return true;
}

// ページ遷移とレンダリング完了を検知
let currentUrl = window.location.href;
let isProcessing = false;
let mutationObserver = null;
let urlCheckInterval = null;

async function waitForPageReady() {
  if (isProcessing) {
    console.log('[ContentScript] 既に処理中のためスキップします');
    return;
  }
  
  isProcessing = true;
  console.log('[ContentScript] ページ遷移を検知しました。レンダリング完了を待機中...');
  
  // MutationObserverでDOMの変化を監視
  if (mutationObserver) {
    mutationObserver.disconnect();
  }
  
  let lastMutationTime = Date.now();
  const MUTATION_TIMEOUT = 2000; // 2秒間変化がなければ完了とみなす
  
  mutationObserver = new MutationObserver(() => {
    lastMutationTime = Date.now();
    console.log('[ContentScript] DOMの変化を検知しました');
  });
  
  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });
  
  // 固定待機時間（2000ms）
  console.log('[ContentScript] 2000ms待機中（画像・数式のレンダリング待ち）...');
  await sleep(2000);
  
  // 追加の待機（DOMの変化が止まるまで）
  while (Date.now() - lastMutationTime < MUTATION_TIMEOUT) {
    await sleep(100);
  }
  
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  
  console.log('[ContentScript] レンダリング完了を確認しました');
  
  // バックグラウンドに通知
  try {
    await chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.PAGE_READY,
      url: window.location.href,
      timestamp: Date.now()
    });
    console.log('[ContentScript] PAGE_READYメッセージを送信しました');
  } catch (error) {
    console.error('[ContentScript] メッセージ送信エラー:', error);
  }
  
  isProcessing = false;
}

// URLの変化を監視
function startUrlMonitoring() {
  console.log('[ContentScript] URL監視を開始しました');
  
  // popstateイベント（ブラウザの戻る/進む）
  window.addEventListener('popstate', () => {
    console.log('[ContentScript] popstateイベントを検知しました');
    currentUrl = window.location.href;
    waitForPageReady();
  });
  
  // 定期的にURLをチェック（SPAのpushState/replaceState対策）
  urlCheckInterval = setInterval(() => {
    const newUrl = window.location.href;
    if (newUrl !== currentUrl) {
      console.log('[ContentScript] URLの変化を検知しました:', currentUrl, '->', newUrl);
      currentUrl = newUrl;
      waitForPageReady();
    }
  }, 500);
  
  // pushState/replaceStateを監視
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(() => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        console.log('[ContentScript] pushStateによるURL変化を検知しました');
        currentUrl = newUrl;
        waitForPageReady();
      }
    }, 0);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(() => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        console.log('[ContentScript] replaceStateによるURL変化を検知しました');
        currentUrl = newUrl;
        waitForPageReady();
      }
    }, 0);
  };
}

// メッセージハンドラー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ContentScript] メッセージを受信しました:', message);
  
  if (message.type === MESSAGE_TYPES.NEXT_PAGE_REQUEST) {
    (async () => {
      try {
        const clicked = await clickNextButton();
        if (clicked) {
          sendResponse({ success: true });
        } else {
          sendResponse({ 
            success: false, 
            type: MESSAGE_TYPES.NO_MORE_PAGES 
          });
        }
      } catch (error) {
        console.error('[ContentScript] エラー:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    // 非同期処理のためtrueを返す
    return true;
  }
});

// 初期化
function init() {
  console.log('[ContentScript] 初期化を開始しました');
  
  // 印刷用スタイルの注入
  injectPrintStyles();
  
  // URL監視の開始
  startUrlMonitoring();
  
  // 初回ページ読み込み時の通知
  waitForPageReady();
  
  console.log('[ContentScript] 初期化が完了しました');
}

// DOMContentLoadedまたは既に読み込み済みの場合
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}