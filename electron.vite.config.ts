import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'electron/main.ts') } },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'electron/preload.ts') } },
    },
  },
  renderer: {
    root: __dirname,
    plugins: [react(), tailwindcss()],
    resolve: {
      // 组件层里写 "../../../components/ui/button" 就没人愿意拆组件了
      alias: { '@': resolve(__dirname, 'src') },
    },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'index.html') } },
    },
  },
});
