import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, readFileSync, writeFileSync, existsSync, renameSync, mkdirSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// manifest.jsonをコピーするプラグイン
const copyManifestPlugin = () => {
  return {
    name: 'copy-manifest',
    writeBundle() {
      const srcManifest = resolve(__dirname, 'src/manifest.json');
      const destManifest = resolve(__dirname, 'dist/manifest.json');
      copyFileSync(srcManifest, destManifest);
      console.log('[vite] manifest.json copied to dist/');
    },
  };
};

// popup.htmlを正しい場所に移動し、パスを修正するプラグイン
const fixPopupHtmlPlugin = () => {
  return {
    name: 'fix-popup-html',
    writeBundle() {
      // まず、間違った場所にあるpopup.htmlを確認
      const wrongPath = resolve(__dirname, 'dist/src/popup/popup.html');
      const correctPath = resolve(__dirname, 'dist/popup/popup.html');
      const correctDir = resolve(__dirname, 'dist/popup');
      const wrongDir = resolve(__dirname, 'dist/src');
      
      try {
        // 間違った場所にファイルがある場合、正しい場所に移動
        if (existsSync(wrongPath)) {
          // popupディレクトリが存在しない場合は作成
          if (!existsSync(correctDir)) {
            mkdirSync(correctDir, { recursive: true });
          }
          // ファイルを移動
          renameSync(wrongPath, correctPath);
          console.log('[vite] popup.html moved from dist/src/popup/ to dist/popup/');
          
          // 空になったsrcディレクトリを削除
          try {
            const srcPopupDir = resolve(__dirname, 'dist/src/popup');
            if (existsSync(srcPopupDir)) {
              rmSync(srcPopupDir, { recursive: true, force: true });
            }
            if (existsSync(wrongDir)) {
              // srcディレクトリが空か確認して削除
              try {
                rmSync(wrongDir, { recursive: true, force: true });
                console.log('[vite] Removed empty dist/src/ directory');
              } catch (e) {
                // ディレクトリが空でない場合は無視
              }
            }
          } catch (e) {
            // 削除エラーは無視
          }
        }
        
        // 正しい場所のpopup.htmlのパスを修正
        if (existsSync(correctPath)) {
          let html = readFileSync(correctPath, 'utf-8');
          // Viteが生成したパスを修正（相対パスに）
          // 様々なパターンに対応
          html = html.replace(/src="[^"]*popup\.js"/g, 'src="./popup.js"');
          html = html.replace(/src="[^"]*\/popup\/popup\.js"/g, 'src="./popup.js"');
          html = html.replace(/src="\.\/popup\/popup\.js"/g, 'src="./popup.js"');
          html = html.replace(/src="[^"]*\/src\/popup\/popup\.js"/g, 'src="./popup.js"');
          writeFileSync(correctPath, html, 'utf-8');
          console.log('[vite] popup.html paths fixed');
        } else {
          console.warn('[vite] popup.html not found at:', correctPath);
        }
      } catch (error) {
        console.warn('[vite] Could not fix popup.html:', error.message);
      }
    },
  };
};

export default defineConfig({
  plugins: [copyManifestPlugin(), fixPopupHtmlPlugin()],
  build: {
    rollupOptions: {
      input: {
        'popup/popup': resolve(__dirname, 'src/popup/popup.html'),
        'background/background': resolve(__dirname, 'src/background/background.js'),
        'content/content': resolve(__dirname, 'src/content/content.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // HTMLファイルは元のディレクトリ構造を維持
          if (assetInfo.name && assetInfo.name.endsWith('.html')) {
            const name = assetInfo.name;
            if (name.includes('popup')) {
              return 'popup/popup.html';
            }
          }
          return '[name][extname]';
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
