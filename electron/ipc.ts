/**
 * 主进程的 IPC 处理器：把渲染进程的请求接到 ffmpeg 能力上。
 * 每个处理函数只做三件事：校验入参、调用能力、把结果/错误整理成契约形状。
 */
import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { buildArgs } from '../src/lib/ffmpeg-args';
import { assessConvertibility } from '../src/lib/ffprobe';
import { hashKey } from '../src/lib/thumbnail-cache';
import type {
  ConvertRequest,
  ConvertResponse,
  HardwareReport,
  ProbeResponse,
  ThumbnailResponse,
} from '../src/lib/ipc-types';
import { resolveBinaries } from './ffmpeg/binary';
import { startConvert, type ConvertHandle } from './ffmpeg/convert';
import { probeFile } from './ffmpeg/probe';
import { ensureThumbnail } from './ffmpeg/thumbnail';

const execFileAsync = promisify(execFile);

const VIDEO_FILTERS = [
  { name: '视频文件', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'flv', 'wmv', 'm4v', 'mpg', 'mpeg', 'ts', 'mxf'] },
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
        hw: request.hw ?? 'none',
        hasAudio: request.hasAudio,
        targetSizeMiB: request.targetSizeMiB ?? null,
        durationSec: request.durationSec,
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

  // 供测试与排错：主进程启动时把二进制来源写进日志
  const sourceLabel = binaries.source === 'bundled' ? '随包分发' : '系统 PATH';
  console.log(`[ffshift] ffmpeg 来源：${sourceLabel}（${binaries.ffmpeg}）`);
  console.log(`[ffshift] 缓存目录：${cachePaths.cacheDir}（键示例 ${hashKey(cachePaths.cacheDir)}）`);
}

export function disposeIpc(): void {
  for (const handle of runningTasks.values()) handle.cancel();
  runningTasks.clear();
}

/** 输出路径里带上源文件哈希，避免同名不同源互相覆盖。 */
export function uniqueOutputSuffix(inputPath: string): string {
  const stats = statSync(inputPath);
  return hashKey(`${inputPath}|${stats.size}`).slice(0, 6);
}
