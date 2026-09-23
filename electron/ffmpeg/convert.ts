/**
 * 转换任务：起一个 ffmpeg 子进程，把进度回吐给界面，支持取消并清理半成品。
 *
 * 边界：这里只负责"进程生命周期 + 进度事件"，参数从 src/lib/ffmpeg-args.ts 来、
 * 报错翻译从 src/lib/errors.ts 来，都是纯函数，可单测。
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { translateError, type TranslatedError } from '../../src/lib/errors';
import {
  ProgressChunker,
  computePercent,
  computeRemaining,
  parseDurationFromStderr,
  parseProgressBlock,
} from '../../src/lib/progress';

export interface ProgressUpdate {
  percent: number | null;
  remainingSec: number | null;
  outTimeSec: number | null;
  speed: number | null;
  totalSizeBytes: number | null;
}

export type ConvertOutcome =
  | {
      status: 'done';
      elapsedMs: number;
      /** 产物大小；用来在界面上和源文件比体积（读不到时为 null） */
      outputSizeBytes: number | null;
    }
  | { status: 'failed'; error: TranslatedError; exitCode: number | null }
  | { status: 'cancelled' };

export interface ConvertOptions {
  ffmpegPath: string;
  args: string[];
  outputPath: string;
  durationSec: number | null;
  onProgress?: (update: ProgressUpdate) => void;
  /** 进度事件节流，默认 100ms；长任务下界面不被事件淹没 */
  throttleMs?: number;
}

export interface ConvertHandle {
  promise: Promise<ConvertOutcome>;
  cancel: () => void;
  pid: number | undefined;
}

/** 读产物大小；读不到（被删、权限问题）返回 null，界面按"未知"处理 */
function sizeOf(filePath: string): number | null {
  try {
    return statSync(filePath).size;
  } catch {
    return null;
  }
}

/** 取消后删掉半成品：留着会让用户以为转换成功过。 */
function removePartial(outputPath: string): void {
  try {
    if (existsSync(outputPath)) rmSync(outputPath, { force: true });
  } catch {
    /* 删不掉不影响结果判定，交给下次转换覆盖 */
  }
}

export function startConvert(options: ConvertOptions): ConvertHandle {
  const { ffmpegPath, args, outputPath, durationSec, onProgress, throttleMs = 100 } = options;

  // 用户选了目录我们就负责建出来：让 ffmpeg 报 "No such file or directory" 是甩锅
  try {
    mkdirSync(dirname(outputPath), { recursive: true });
  } catch (error) {
    return {
      pid: undefined,
      cancel: () => undefined,
      promise: Promise.resolve<ConvertOutcome>({
        status: 'failed',
        exitCode: null,
        error: {
          kind: 'output-permission',
          title: '无法创建输出目录',
          hint: '换一个可写入的位置，或先手动建好这个目录。',
          raw: error instanceof Error ? error.message : String(error),
        },
      }),
    };
  }

  const child: ChildProcess = spawn(ffmpegPath, args, { windowsHide: true });
  const chunker = new ProgressChunker();
  const stderrLines: string[] = [];
  const started = Date.now();

  let cancelled = false;
  let lastEmit = 0;
  // 探针没给出时长时，从 ffmpeg 自己的输出里补一个，避免进度条只能显示"进行中"
  let effectiveDuration = durationSec;

  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    for (const block of chunker.push(chunk)) {
      const sample = parseProgressBlock(block);
      const now = Date.now();
      // progress=end 一定放行，避免最后一次进度被节流丢掉
      if (!sample.done && now - lastEmit < throttleMs) continue;
      lastEmit = now;

      onProgress?.({
        percent:
          sample.outTimeSec === null ? null : computePercent(sample.outTimeSec, effectiveDuration ?? 0),
        remainingSec:
          sample.outTimeSec === null
            ? null
            : computeRemaining(sample.outTimeSec, effectiveDuration ?? 0, sample.speed),
        outTimeSec: sample.outTimeSec,
        speed: sample.speed,
        totalSizeBytes: sample.totalSizeBytes,
      });
    }
  });

  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk: string) => {
    // 探针没给出时长时，从 ffmpeg 自己的输出里补一个
    if (effectiveDuration === null) {
      const parsed = parseDurationFromStderr(chunk);
      if (parsed !== null) effectiveDuration = parsed;
    }
    // 只留最后 50 行：再多也没人看，还会占内存
    stderrLines.push(...chunk.split(/\r?\n/).filter(Boolean));
    if (stderrLines.length > 50) stderrLines.splice(0, stderrLines.length - 50);
  });

  const promise = new Promise<ConvertOutcome>((resolve) => {
    child.on('error', (error) => {
      resolve({
        status: 'failed',
        error: translateError(error.message, null),
        exitCode: null,
      });
    });

    child.on('close', (code) => {
      if (cancelled) {
        removePartial(outputPath);
        resolve({ status: 'cancelled' });
        return;
      }
      if (code === 0) {
        resolve({ status: 'done', elapsedMs: Date.now() - started, outputSizeBytes: sizeOf(outputPath) });
        return;
      }
      // 失败同样要清：留着损坏的半成品，用户会以为转换成功过
      removePartial(outputPath);
      resolve({
        status: 'failed',
        error: translateError(stderrLines.join('\n'), code),
        exitCode: code,
      });
    });
  });

  return {
    promise,
    pid: child.pid,
    cancel: () => {
      cancelled = true;
      child.kill();
    },
  };
}
