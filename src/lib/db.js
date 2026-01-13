// IndexedDB管理モジュール
// 大量のPDFバイナリデータをローカルストレージに一時保存する

const DB_NAME = 'OReillyDownloaderDB';
const STORE_NAME = 'pdf_pages';
const DB_VERSION = 1;

// データベースの初期化
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('IndexedDBのオープンに失敗しました: ' + request.error));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // オブジェクトストアが存在しない場合は作成
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: 'pageNumber',
          autoIncrement: false
        });
        
        // インデックスを作成（ソート用）
        objectStore.createIndex('pageNumber', 'pageNumber', { unique: true });
        
        console.log('[DB] オブジェクトストアを作成しました:', STORE_NAME);
      }
    };
  });
}

/**
 * PDFバイナリデータをIndexedDBに保存
 * @param {number} pageNumber - ページ番号
 * @param {Uint8Array} data - PDFバイナリデータ
 * @returns {Promise<void>}
 */
export async function savePage(pageNumber, data) {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      
      const request = objectStore.put({
        pageNumber: pageNumber,
        data: data,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => {
        console.log(`[DB] ページ ${pageNumber} を保存しました`);
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error(`ページ ${pageNumber} の保存に失敗しました: ${request.error}`));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[DB] savePage エラー:', error);
    throw error;
  }
}

/**
 * 全ページをページ番号順に取得
 * @returns {Promise<Array<{pageNumber: number, data: Uint8Array}>>}
 */
export async function getAllPagesSorted() {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index('pageNumber');
      
      const request = index.getAll();
      
      request.onsuccess = () => {
        const pages = request.result;
        // ページ番号でソート（念のため）
        pages.sort((a, b) => a.pageNumber - b.pageNumber);
        
        console.log(`[DB] ${pages.length} ページを取得しました`);
        resolve(pages);
      };
      
      request.onerror = () => {
        reject(new Error('ページの取得に失敗しました: ' + request.error));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[DB] getAllPagesSorted エラー:', error);
    throw error;
  }
}

/**
 * 全データをクリーンアップ
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const objectStore = transaction.objectStore(STORE_NAME);
      
      const request = objectStore.clear();
      
      request.onsuccess = () => {
        console.log('[DB] 全データをクリーンアップしました');
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error('データのクリーンアップに失敗しました: ' + request.error));
      };
      
      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('[DB] clearAllData エラー:', error);
    throw error;
  }
}

/**
 * データベースを完全に削除
 * @returns {Promise<void>}
 */
export async function deleteDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    
    request.onsuccess = () => {
      console.log('[DB] データベースを削除しました');
      resolve();
    };
    
    request.onerror = () => {
      reject(new Error('データベースの削除に失敗しました: ' + request.error));
    };
    
    request.onblocked = () => {
      console.warn('[DB] データベースの削除がブロックされました');
    };
  });
}
