/**
 * 渲染进程入口：先接上主进程的事件（进度、完成），再挂载界面。
 * 顺序不能颠倒——界面一挂载就可能开始转换，那时监听必须已经就位。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { bindIpcEvents } from './store';
import './styles.css';

bindIpcEvents();

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
