/**
 * 主进程的 IPC 处理器：把渲染进程的请求接到 ffmpeg 能力上。
 * 每个处理函数只做三件事：校验入参、调用能力、把结果/错误整理成契约形状。
 */
import { app, dialog, ipcMain, Notification, shell, type BrowserWindow } from 'electron';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import { buildArgs } from '../src/lib/ffmpeg-args';
import { assessConvertibility } from '../src/lib/ffprobe';
import type { CloseAction } from '../src/lib/settings';
import type {
  ConvertRequest,
  ConvertResponse,
  HardwareReport,
  ProbeResponse,
  ThumbnailResponse,
} from '../src/lib/ipc-types';
import { loadSettings, saveSettings } from './settings';
import { resolveBinaries } from './ffmpeg/binary';
import { startConvert, type ConvertHandle } from './ffmpeg/convert';
import { probeFile } from './ffmpeg/probe';
import { ensureThumbnail } from './ffmpeg/thumbnail';

const execFileAsync = promisify(execFile);

/** 能被转换器认下的视频扩展名；文件对话框与文件夹扫描都用这一份 */
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'mkv', 'avi', 'webm', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', 'ts', 'mxf'];

const VIDEO_FILTERS = [
  { name: '视频文件', extensions: VIDEO_EXTENSIONS },
  { name: '全部文件', extensions: ['*'] },
];

/** 每个窗口一份转换任务表：取消时按 id 找进程。 */
const runningTasks = new Map<string, ConvertHandle>();

interface Deps {
  getWindow: () => BrowserWindow | null;
}

export function registerIpc({ getWindow }: Deps): void {
  const bundledDir = app.isPackaged
    ? join(process.resourcesPath, 'ffmpeg')
    : join(app.getAppPath(), 'resources', 'ffmpeg');
  const binaries = resolveBinaries(bundledDir);

  const cachePaths = {
    cacheDir: join(app.getPath('userData'), 'thumbnails'),
    logsDir: join(app.getPath('userData'), 'logs'),
  };

  ipcMain.handle('ffshift:pick-files', async () => {
    const window = getWindow();
    const result = window
      ? await dialog.showOpenDialog(window, { properties: ['openFile', 'multiSelections'], filters: VIDEO_FILTERS })
      : await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: VIDEO_FILTERS });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('ffshift:pick-folder', async (_event, title?: string) => {
    const window = getWindow();
    const options = {
      title: typeof title === 'string' && title.length > 0 ? title : '选择文件夹',
      properties: ['openDirectory' as const],
    };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle('ffshift:scan-folder', async (_event, folder: string) => {
    if (typeof folder !== 'string' || !existsSync(folder)) return [];
    try {
      // 只扫一层：用户选的是一个文件夹，不是整棵目录树；递归容易把系统里的零碎视频也拖进来
      return readdirSync(folder, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => join(folder, entry.name))
        .filter((fullPath) => VIDEO_EXTENSIONS.includes(extname(fullPath).slice(1).toLowerCase()))
        .sort();
    } catch {
      return [];
    }
  });

  ipcMain.handle('ffshift:read-presets', async () => {
    const window = getWindow();
    const options = {
      title: '导入参数预设',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
      properties: ['openFile' as const],
    };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    const file = result.filePaths[0];
    if (result.canceled || !file) return null;

    try {
      return readFileSync(file, 'utf8');
    } catch {
      return null;
    }
  });

  ipcMain.handle('ffshift:write-presets', async (_event, content: string) => {
    if (typeof content !== 'string' || content.length === 0) return { ok: false };

    const window = getWindow();
    const options = {
      title: '导出参数预设',
      defaultPath: 'ffshift-presets.json',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    };
    const result = window ? await dialog.showSaveDialog(window, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { ok: false };

    try {
      writeFileSync(result.filePath, content, 'utf8');
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('ffshift:notify', async (_event, title: string, body: string) => {
    // 系统通知让用户能去干别的：长任务跑完时人往往不在窗口前面
    if (!Notification.isSupported()) return { ok: false };
    if (typeof title !== 'string' || title.length === 0) return { ok: false };
    try {
      new Notification({ title, body: typeof body === 'string' ? body : '' }).show();
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('ffshift:ffmpeg-version', async () => {
    try {
      const { stdout } = await execFileAsync(binaries.ffmpeg, ['-version'], { timeout: 10_000 });
      return stdout.split('\n')[0]?.trim() ?? null;
    } catch {
      return null;
    }
  });

  ipcMain.handle('ffshift:probe', async (_event, filePath: string): Promise<ProbeResponse> => {
    if (typeof filePath !== 'string' || !existsSync(filePath)) {
      return { ok: false, reason: '文件不存在或已被移动' };
    }
    try {
      const info = await probeFile(binaries.ffprobe, filePath);
      const convertibility = assessConvertibility(info);
      return { ok: true, info, convertibility };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(
    'ffshift:thumbnail',
    async (_event, filePath: string, durationSec: number | null): Promise<ThumbnailResponse> => {
      try {
        const result = await ensureThumbnail(binaries.ffmpeg, filePath, durationSec, cachePaths);
        // 直接把图读成 dataURL：渲染进程不接触文件系统
        const { readFile } = await import('node:fs/promises');
        const buffer = await readFile(result.path);
        return { ok: true, dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}` };
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : String(error) };
      }
    },
  );

  ipcMain.handle('ffshift:convert', async (_event, request: ConvertRequest): Promise<ConvertResponse> => {
    if (!existsSync(request.input)) return { ok: false, reason: '输入文件不存在' };

    try {
      const args = buildArgs({
        input: request.input,
        output: request.output,
        preset: request.preset,
        format: request.format ?? 'same',
        hw: request.hw ?? 'none',
        hasAudio: request.hasAudio,
        targetSizeMiB: request.targetSizeMiB ?? null,
        durationSec: request.durationSec,
        source: request.source,
        advanced: request.advanced ?? null,
      });

      const window = getWindow();
      const handle = startConvert({
        ffmpegPath: binaries.ffmpeg,
        args,
        outputPath: request.output,
        durationSec: request.durationSec,
        onProgress: (update) => {
          window?.webContents.send('ffshift:progress', { taskId: request.taskId, update });
        },
      });

      runningTasks.set(request.taskId, handle);

      void handle.promise.then((outcome) => {
        runningTasks.delete(request.taskId);
        window?.webContents.send('ffshift:finished', { taskId: request.taskId, outcome });
      });

      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('ffshift:cancel', async (_event, taskId: string) => {
    const handle = runningTasks.get(taskId);
    if (!handle) return { ok: false };
    handle.cancel();
    runningTasks.delete(taskId);
    return { ok: true };
  });

  ipcMain.handle('ffshift:detect-hardware', async (): Promise<HardwareReport> => {
    const candidates = ['h264_nvenc', 'hevc_nvenc', 'h264_qsv', 'hevc_qsv', 'h264_amf', 'hevc_amf'];
    const available: HardwareReport['available'] = [];

    // 列表里有 ≠ 能用：逐个试编码 1 秒，退出码 0 才算数
    for (const encoder of candidates) {
      try {
        await execFileAsync(
          binaries.ffmpeg,
          ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=25',
            '-t', '1', '-c:v', encoder, '-f', 'null', '-'],
          { timeout: 30_000 },
        );
        const family = encoder.includes('nvenc') ? 'nvenc' : encoder.includes('qsv') ? 'qsv' : 'amf';
        if (!available.includes(family)) available.push(family);
      } catch {
        /* 这个编码器不可用，继续下一个 */
      }
    }

    return { available, checkedAt: new Date().toISOString() };
  });

  ipcMain.handle('ffshift:load-settings', async () => loadSettings());
  ipcMain.handle('ffshift:save-settings', async (_event, settings: unknown) => saveSettings(settings));

  /**
   * 用户在关闭确认框里选了怎么办。
   *
   * 两个动作都由主进程执行（隐藏或关闭窗口），渲染进程只负责传达选择——
   * 它拿不到窗口状态，也不该为此多开一条权限。
   */
  ipcMain.handle('ffshift:close-choice', async (_event, choice: unknown, remember: unknown) => {
    const action: CloseAction = choice === 'quit' ? 'quit' : 'tray';

    if (remember === true) {
      saveSettings({ ...loadSettings(), closeAction: action });
    }

    const window = getWindow();
    if (action === 'quit') {
      // 走 close 才会触发 window-all-closed 里的清理
      app.quit();
    } else {
      window?.hide();
    }
    return { ok: true };
  });

  // 无边框窗口：标题栏是自己画的，三个按钮与最大化状态都得有对应通道。
  // 用 send 而不是 invoke：这些都是"发出去就完成"的动作，等回执只会让按钮感觉有延迟。
  ipcMain.on('ffshift:frame', (_event, action: unknown) => {
    const window = getWindow();
    if (!window) return;

    if (action === 'minimize') window.minimize();
    else if (action === 'toggle-maximize') {
      if (window.isMaximized()) window.unmaximize();
      else window.maximize();
    } else if (action === 'close') window.close();
  });

  ipcMain.handle('ffshift:frame-maximized', async () => getWindow()?.isMaximized() ?? false);

  // 转换完成后让用户直接看到文件：在资源管理器里高亮选中，而不是只给个路径
  ipcMain.handle('ffshift:reveal-output', async (_event, filePath: string) => {
    if (typeof filePath !== 'string' || !existsSync(filePath)) return { ok: false };
    shell.showItemInFolder(filePath);
    return { ok: true };
  });

  // 记一行来源：出问题时能一眼看出用的是随包二进制还是系统里那个
  const sourceLabel = binaries.source === 'bundled' ? '随包分发' : '系统 PATH';
  console.log(`[ffshift] ffmpeg 来源：${sourceLabel}（${binaries.ffmpeg}）`);
  console.log(`[ffshift] 缩略图缓存：${cachePaths.cacheDir}`);
}

export function disposeIpc(): void {
  for (const handle of runningTasks.values()) handle.cancel();
  runningTasks.clear();
}
