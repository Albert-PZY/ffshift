/**
 * 解析 ffmpeg `-progress pipe:1` 的输出。
 *
 * ffmpeg 按块输出 `key=value`，块之间用 `progress=continue|end` 分隔。
 * 两个已知坑：
 *   1. `out_time_ms` 实际是微秒（历史遗留），与 `out_time_us` 数值相同；
 *   2. `speed` 带 `x` 后缀，且可能为 `N/A`。
 * 这里只做纯解析与计算，不碰进程与 IO，便于单测覆盖。
 */

export interface ProgressSample {
  /** 已处理时长（秒）；未知为 null */
  outTimeSec: number | null;
  /** 处理速度倍数；未知为 null */
  speed: number | null;
  /** 已写出的字节数；未知为 null */
  totalSizeBytes: number | null;
  /** 是否收到 progress=end */
  done: boolean;
}

export function parseProgressBlock(text: string): ProgressSample {
  const sample: ProgressSample = { outTimeSec: null, speed: null, totalSizeBytes: null, done: false };
  let hasUs = false;

  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    switch (key) {
      case 'out_time_us': {
        const micros = Number(value);
        if (Number.isFinite(micros)) {
          sample.outTimeSec = micros / 1_000_000;
          hasUs = true;
        }
        break;
      }
      case 'out_time_ms': {
        // 只在没有 out_time_us 时兜底；同样按微秒处理
        if (hasUs) break;
        const micros = Number(value);
        if (Number.isFinite(micros)) sample.outTimeSec = micros / 1_000_000;
        break;
      }
      case 'speed': {
        const parsed = value.endsWith('x') ? Number(value.slice(0, -1)) : Number.NaN;
        sample.speed = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        break;
      }
      case 'total_size': {
        const bytes = Number(value);
        sample.totalSizeBytes = Number.isFinite(bytes) && bytes >= 0 ? bytes : null;
        break;
      }
      case 'progress': {
        sample.done = value === 'end';
        break;
      }
      default:
        break;
    }
  }

  return sample;
}

/** 百分比 0–1；时长不可用时返回 null，由界面降级展示。 */
export function computePercent(outTimeSec: number, durationSec: number): number | null {
  if (!Number.isFinite(outTimeSec) || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  return Math.min(1, Math.max(0, outTimeSec / durationSec));
}

/** 剩余秒数；速度或时长不可用时返回 null。 */
export function computeRemaining(
  outTimeSec: number,
  durationSec: number,
  speed: number | null,
): number | null {
  if (!Number.isFinite(outTimeSec) || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  if (speed === null || !Number.isFinite(speed) || speed <= 0) return null;
  return Math.max(0, (durationSec - outTimeSec) / speed);
}

/**
 * 从 ffmpeg 的 stderr 里兜底解析源时长。
 *
 * 什么时候用得上：ffprobe 没给出时长（少数流），但 ffmpeg 自己会打印
 * `Duration: 00:01:23.45`。有了它，进度条才不是瞎转。
 * 只认第一处——多路输入（例如 alpha 合成时加的底色）的时长不是源时长。
 */
export function parseDurationFromStderr(text: string): number | null {
  if (typeof text !== 'string' || text.length === 0) return null;

  const match = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(text);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const total = hours * 3600 + minutes * 60 + seconds;

  return Number.isFinite(total) && total > 0 ? total : null;
}

/**
 * 把流式 stdout 切成一个个完整的进度块。
 *
 * ffmpeg 的进度是持续的 key=value 流，块之间用 `progress=continue|end` 分隔，
 * 而网络/管道给到的 chunk 可能从任意位置切断，所以必须缓冲半个块。
 */
export class ProgressChunker {
  private pendingLines: string[] = [];
  private partialLine = '';

  /** 推入一段原始输出，返回这次攒够的完整块（可能 0 个或多个）。 */
  push(chunk: string): string[] {
    if (chunk.length === 0) return [];

    const blocks: string[] = [];
    const lines = (this.partialLine + chunk).split(/\r?\n/);
    // 最后一段可能被切断，留到下次拼接
    this.partialLine = lines.pop() ?? '';

    for (const line of lines) {
      this.pendingLines.push(line);
      if (line.startsWith('progress=')) {
        blocks.push(this.pendingLines.join('\n'));
        this.pendingLines = [];
      }
    }

    return blocks;
  }
}
