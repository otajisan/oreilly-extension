import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync } from 'fs';
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

export default defineConfig({
  plugins: [copyManifestPlugin()],
  build: {
    rollupOptions: {
      input: {
        'popup/popup': resolve(__dirname, 'src/popup/popup.html'),
        'background/background': resolve(__dirname, 'src/background/background.js'),
        'content/content': resolve(__dirname, 'src/content/content.js'),
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
    outDir: 'dist',
  },
});
