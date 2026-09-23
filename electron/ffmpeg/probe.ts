/**
 * 调 ffprobe 读媒体信息。
 *
 * 只负责"进程调用 + 把输出交给纯函数解析"；
 * 解析规则全在 src/lib/ffprobe.ts 里，那边有单测覆盖。
 */
import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { parseMediaInfo, type MediaInfo } from '../../src/lib/ffprobe';

const PROBE_ARGS = ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams'];

export class ProbeError extends Error {
  constructor(
    message: string,
    readonly stderr: string,
  ) {
    super(message);
    this.name = 'ProbeError';
  }
}

export function probeFile(ffprobePath: string, filePath: string): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    execFile(
      ffprobePath,
      [...PROBE_ARGS, filePath],
      { encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new ProbeError(`ffprobe 无法读取该文件：${filePath}`, stderr || error.message));
          return;
        }
        try {
          const stats = statSync(filePath);
          const json: unknown = JSON.parse(stdout);
          resolve(parseMediaInfo(json, { path: filePath, sizeBytes: stats.size }));
        } catch (parseError) {
          reject(
            new ProbeError(
              `解析 ffprobe 输出失败：${filePath}`,
              parseError instanceof Error ? parseError.message : String(parseError),
            ),
          );
        }
      },
    );
  });
}

/** 并发探测多个文件，最多同时跑 limit 个 ffprobe（架构约定 ≤3）。 */
export async function probeMany(
  ffprobePath: string,
  files: string[],
  limit = 3,
): Promise<Array<{ path: string; info?: MediaInfo; error?: string }>> {
  const results: Array<{ path: string; info?: MediaInfo; error?: string }> = new Array(files.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < files.length) {
      const index = cursor;
      cursor += 1;
      const file = files[index];
      if (file === undefined) continue;
      try {
        results[index] = { path: file, info: await probeFile(ffprobePath, file) };
      } catch (error) {
        results[index] = {
          path: file,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, files.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}
