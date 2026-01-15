// Content Script for O'Reilly Extension
// DOMクレンジングとページ遷移制御

// メッセージタイプ定数
const MESSAGE_TYPES = {
  NEXT_PAGE_REQUEST: 'NEXT_PAGE_REQUEST',
  PAGE_READY: 'PAGE_READY',
  NO_MORE_PAGES: 'NO_MORE_PAGES',
  REQUEST_PAGE_READY: 'REQUEST_PAGE_READY'
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
      /* 本文以外のコンテナも含めて非表示を徹底 */
      #orm-global-site-header, 
      nav, 
      aside, 
      footer,
      [class*="sidebar"],
      [class*="nav-controls"],
      section[class*="iconMenu"],
      #content-navigation {
        display: none !important;
      }
      
      /* 本文領域をページいっぱいに広げる */
      html, body, main, #content-panel, .content-panel, #book-content, article {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
      }
      
      /* 本文が隠れてしまうケースの回避 */
      #content-panel,
      #content-panel > section,
      .content-panel,
      #book-content,
      [data-testid="contentViewer"],
      [data-testid="enhancedAnnotatable"],
      .orm-ChapterReader-readerContainer,
      #sbo-rt-content,
      .content-body,
      .reader-content,
      .reading-pane,
      .page-content,
      article,
      main {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        transform: none !important;
        height: auto !important;
      }
      
      /* O'Reillyの本文コンテナはmax-width指定があるため解除 */
      .orm-ChapterReader-readerContainer,
      #book-content,
      #sbo-rt-content {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
      }

      /* 読みやすさのため本文を中央寄せにする */
      #content-panel > section,
      [data-testid="contentViewer"],
      #book-content,
      .orm-ChapterReader-readerContainer,
      #sbo-rt-content {
        width: 96ch !important;
        max-width: 96ch !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      /* 印刷プレビューで親sectionが非表示になるのを防ぐ */
      #content-panel > section {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        height: auto !important;
      }
      
      /* 印刷時に本文配下が隠れるのを防ぐ */
      body,
      [data-testid="contentViewer"],
      [data-testid="contentViewer"] * {
        visibility: visible !important;
      }
      
      /* PDF出力時のスケーリング対策 */
      @page {
        size: auto;
        margin: 10mm;
      }
    }
  `;
  
  document.head.appendChild(style);
  console.log('[ContentScript] 印刷用スタイルの注入が完了しました');
}

// 次へボタンを探してクリック
async function clickNextButton() {
  console.log('[ContentScript] 次へボタンを検索中...');
  
  // セレクタ候補（優先度順）
  const selectorCandidates = [
    'nav#content-navigation div[class*="nextContainer"] a',
    'div[class*="nextContainer"] a',
    'a[aria-label*="Next"]'
  ];
  
  let nextButton = null;
  let matchedSelector = null;
  for (const selector of selectorCandidates) {
    const candidate = document.querySelector(selector);
    if (candidate) {
      nextButton = candidate;
      matchedSelector = selector;
      break;
    }
  }
  
  if (!nextButton) {
    console.log('[ContentScript] 次へボタンが見つかりませんでした');
    console.log('[ContentScript] 試行したセレクタ:', selectorCandidates);
    console.log('[ContentScript] 次へ候補数（nextContainer）:', document.querySelectorAll('div[class*="nextContainer"] a').length);
    console.log('[ContentScript] 次へ候補数（aria-label）:', document.querySelectorAll('a[aria-label*="Next"]').length);
    return false;
  }
  
  console.log('[ContentScript] 次へボタンが見つかりました。クリックします...', matchedSelector);
  nextButton.click();
  return true;
}

// ページ遷移とレンダリング完了を検知
let currentUrl = window.location.href;
let isProcessing = false;
let mutationObserver = null;
let urlCheckInterval = null;

// 拡張機能が無効化された場合に備えて安全に送信
async function safeSendMessage(message) {
  if (!chrome?.runtime?.id) {
    console.log('[ContentScript] 拡張機能コンテキストが無効のため送信をスキップします');
    return false;
  }
  
  try {
    await chrome.runtime.sendMessage(message);
    return true;
  } catch (error) {
    const errorMessage = error?.message || '';
    if (errorMessage.includes('Extension context invalidated')) {
      console.log('[ContentScript] 拡張機能コンテキストが無効化されています');
      return false;
    }
    console.error('[ContentScript] メッセージ送信エラー:', error);
    return false;
  }
}

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
  
  // DOMクレンジング（印刷用スタイルの注入）を確実に実施
  injectPrintStyles();
  // スタイル適用とレイアウト反映のために短時間待機
  await sleep(100);
  
  // バックグラウンドに通知
  const sent = await safeSendMessage({
    type: MESSAGE_TYPES.PAGE_READY,
    url: window.location.href,
    timestamp: Date.now()
  });
  if (sent) {
    console.log('[ContentScript] PAGE_READYメッセージを送信しました');
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

  if (message.type === MESSAGE_TYPES.REQUEST_PAGE_READY) {
    (async () => {
      try {
        await waitForPageReady();
        sendResponse({ success: true });
      } catch (error) {
        console.error('[ContentScript] PAGE_READYリクエストエラー:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
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

// 二重初期化を防止
if (window.__oreillyExtensionInitialized) {
  console.log('[ContentScript] 既に初期化済みのためスキップします');
} else {
  window.__oreillyExtensionInitialized = true;
  
  // DOMContentLoadedまたは既に読み込み済みの場合
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}