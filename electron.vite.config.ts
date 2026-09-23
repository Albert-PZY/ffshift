import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import pkg from './package.json';

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
    define: {
      // 设置页的「关于」要显示版本号；从 package.json 注入，避免手写第二份
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    },
    resolve: {
      // 组件层里写 "../../../components/ui/button" 就没人愿意拆组件了
      alias: { '@': resolve(__dirname, 'src') },
    },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'index.html') } },
    },
  },
});
