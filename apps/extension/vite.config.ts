import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

// Copy static files after build
function copyStaticFiles() {
  return {
    name: 'copy-static-files',
    writeBundle() {
      const distDir = resolve(__dirname, 'dist');
      
      // Copy manifest
      copyFileSync(
        resolve(__dirname, 'src/manifest.json'),
        resolve(distDir, 'manifest.json')
      );
      
      // Copy CSS
      if (existsSync(resolve(__dirname, 'src/content/content.css'))) {
        copyFileSync(
          resolve(__dirname, 'src/content/content.css'),
          resolve(distDir, 'content.css')
        );
      }
      
      // Copy options HTML
      if (!existsSync(resolve(distDir, 'options'))) {
        mkdirSync(resolve(distDir, 'options'), { recursive: true });
      }
      copyFileSync(
        resolve(__dirname, 'src/options/index.html'),
        resolve(distDir, 'options/index.html')
      );
      
      // Copy icons
      const iconsDir = resolve(distDir, 'icons');
      if (!existsSync(iconsDir)) {
        mkdirSync(iconsDir, { recursive: true });
      }
      const iconSizes = ['16', '48', '128'];
      for (const size of iconSizes) {
        const srcPath = resolve(__dirname, `public/icons/icon${size}.png`);
        if (existsSync(srcPath)) {
          copyFileSync(srcPath, resolve(iconsDir, `icon${size}.png`));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyStaticFiles()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.tsx'),
        clanker: resolve(__dirname, 'src/content/sites/clanker.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
