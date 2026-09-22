/**
 * 定位 ffmpeg / ffprobe。
 *
 * 优先用随包分发的二进制（resources/ffmpeg/），找不到就退回系统 PATH。
 * 两种来源都要能跑，开发者不必先把二进制塞进项目。
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface BinaryPaths {
  ffmpeg: string;
  ffprobe: string;
  source: 'bundled' | 'system';
}

const exeName = (name: string) => (process.platform === 'win32' ? `${name}.exe` : name);

export function resolveBinaries(bundledDir?: string): BinaryPaths {
  if (bundledDir) {
    const ffmpeg = join(bundledDir, exeName('ffmpeg'));
    const ffprobe = join(bundledDir, exeName('ffprobe'));
    if (existsSync(ffmpeg) && existsSync(ffprobe)) {
      return { ffmpeg, ffprobe, source: 'bundled' };
    }
  }
  return { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe', source: 'system' };
}

/** 取版本首行；不可用返回 null。用来在界面上显示"用的是哪个 ffmpeg"。 */
export function binaryVersion(binary: string): string | null {
  try {
    const output = execFileSync(binary, ['-version'], {
      encoding: 'utf8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const first = output.split('\n')[0]?.trim();
    return first && first.length > 0 ? first : null;
  } catch {
    return null;
  }
}

export function isAvailable(binary: string): boolean {
  return binaryVersion(binary) !== null;
}
