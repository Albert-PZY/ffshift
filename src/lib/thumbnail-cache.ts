/**
 * 缩略图缓存的键与路径。
 * 缓存键必须同时反映"哪个文件"和"这个文件是不是被换过"，
 * 只用路径会让替换后的视频继续显示旧缩略图。
 */
import { join } from 'node:path';

export interface CachePaths {
  cacheDir: string;
  logsDir: string;
}

/**
 * FNV-1a 变体，输出 16 位十六进制。
 * 用纯 JS 实现而不是 node:crypto：主进程与测试环境都能用，也不引入额外依赖。
 */
export function hashKey(input: string): string {
  let low = 0x811c9dc5;
  let high = 0xc9dc5118;

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    low ^= code;
    low = Math.imul(low, 0x01000193) >>> 0;
    high ^= code + index;
    high = Math.imul(high, 0x01000193) >>> 0;
  }

  return low.toString(16).padStart(8, '0') + high.toString(16).padStart(8, '0');
}

export function thumbnailCacheKey(input: {
  path: string;
  mtimeMs: number;
  sizeBytes: number;
}): string {
  // Windows 路径大小写与分隔符写法不统一，先归一化，避免同一文件算出两个键
  const normalized = input.path.replace(/\//g, '\\').toLowerCase();
  return hashKey(`${normalized}|${Math.round(input.mtimeMs)}|${input.sizeBytes}`);
}

export function thumbnailPath(paths: CachePaths, key: string): string {
  return join(paths.cacheDir, `${key}.jpg`);
}
