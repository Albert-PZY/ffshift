/**
 * 渲染进程入口：先定主题与字号、再接主进程的事件（进度、完成），最后挂载界面。
 * 顺序不能颠倒——界面一挂载就可能开始转换，那时监听必须已经就位；
 * 主题与字号要在建 root 之前就挂上，晚一帧就会看见界面闪一下或跳一下。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyFontSize, FONT_SIZE_DEFAULT } from './lib/font-scale';
import { DEFAULT_SETTINGS, type FontSize, type Theme } from './lib/settings';
import { applyTheme } from './lib/theme';
import { bindIpcEvents } from './store';
import './styles/globals.css';

const initialTheme: Theme = window.ffshift?.initialTheme ?? DEFAULT_SETTINGS.theme;
const initialFontSize: FontSize = window.ffshift?.initialFontSize ?? FONT_SIZE_DEFAULT;
applyTheme(initialTheme);
applyFontSize(initialFontSize);

bindIpcEvents();

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
