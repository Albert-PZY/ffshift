/**
 * preload：把主进程能力白名单式地暴露给渲染进程。
 * 渲染进程拿不到 Node，只能调这里列出的方法。
 */
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { fontSizeFromArgv } from '../src/lib/font-scale';
import type { AppSettings } from '../src/lib/settings';
import { themeFromArgv } from '../src/lib/theme';
import type {
  ConvertRequest,
  ConvertResponse,
  FinishedEvent,
  FfshiftApi,
  HardwareReport,
  ProbeResponse,
  ProgressEvent,
  ThumbnailResponse,
} from '../src/lib/ipc-types';

const api: FfshiftApi & { getPathForFile: (file: File) => string } = {
  pickFiles: () => ipcRenderer.invoke('ffshift:pick-files') as Promise<string[]>,
  readPresetsFile: () => ipcRenderer.invoke('ffshift:read-presets') as Promise<string | null>,
  writePresetsFile: (content: string) =>
    ipcRenderer.invoke('ffshift:write-presets', content) as Promise<{ ok: boolean }>,
  pickFolder: (title?: string) => ipcRenderer.invoke('ffshift:pick-folder', title) as Promise<string[]>,
  scanFolder: (folder: string) => ipcRenderer.invoke('ffshift:scan-folder', folder) as Promise<string[]>,
  notify: (title: string, body: string) =>
    ipcRenderer.invoke('ffshift:notify', title, body) as Promise<{ ok: boolean }>,
  probe: (path) => ipcRenderer.invoke('ffshift:probe', path) as Promise<ProbeResponse>,
  thumbnail: (path, durationSec) =>
    ipcRenderer.invoke('ffshift:thumbnail', path, durationSec) as Promise<ThumbnailResponse>,
  convert: (request: ConvertRequest) =>
    ipcRenderer.invoke('ffshift:convert', request) as Promise<ConvertResponse>,
  cancel: (taskId) => ipcRenderer.invoke('ffshift:cancel', taskId) as Promise<{ ok: boolean }>,
  detectHardware: () => ipcRenderer.invoke('ffshift:detect-hardware') as Promise<HardwareReport>,
  ffmpegVersion: () => ipcRenderer.invoke('ffshift:ffmpeg-version') as Promise<string | null>,
  loadSettings: () => ipcRenderer.invoke('ffshift:load-settings') as Promise<AppSettings>,
  saveSettings: (settings: AppSettings) =>
    ipcRenderer.invoke('ffshift:save-settings', settings) as Promise<AppSettings>,
  revealOutput: (filePath: string) =>
    ipcRenderer.invoke('ffshift:reveal-output', filePath) as Promise<{ ok: boolean }>,

  frame: {
    minimize: () => ipcRenderer.send('ffshift:frame', 'minimize'),
    toggleMaximize: () => ipcRenderer.send('ffshift:frame', 'toggle-maximize'),
    close: () => ipcRenderer.send('ffshift:frame', 'close'),
    isMaximized: () => ipcRenderer.invoke('ffshift:frame-maximized') as Promise<boolean>,
  },

  // 主进程在建窗口时写进 argv，所以这两个是同步值
  initialTheme: themeFromArgv(process.argv),
  initialFontSize: fontSizeFromArgv(process.argv),

  onProgress: (listener) => {
    const handler = (_event: unknown, payload: ProgressEvent) => listener(payload);
    ipcRenderer.on('ffshift:progress', handler);
    return () => {
      ipcRenderer.removeListener('ffshift:progress', handler);
    };
  },

  onFinished: (listener) => {
    const handler = (_event: unknown, payload: FinishedEvent) => listener(payload);
    ipcRenderer.on('ffshift:finished', handler);
    return () => {
      ipcRenderer.removeListener('ffshift:finished', handler);
    };
  },

  // 拖放进来的 File 对象在渲染进程拿不到磁盘路径，必须走这个方法
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld('ffshift', api);
