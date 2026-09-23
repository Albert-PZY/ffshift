/**
 * 渲染进程入口：先定主题、再接主进程的事件（进度、完成），最后挂载界面。
 * 顺序不能颠倒——界面一挂载就可能开始转换，那时监听必须已经就位；
 * 而主题要在建 root 之前就挂上，晚一帧就会看见另一个主题闪一下。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import type { Theme } from './lib/settings';
import { applyTheme } from './lib/theme';
import { bindIpcEvents } from './store';
import './styles/globals.css';

const initialTheme: Theme = window.ffshift?.initialTheme ?? 'light';
applyTheme(initialTheme);

bindIpcEvents();

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
