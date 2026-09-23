/**
 * 缩略图：抽一帧存进缓存目录，同一个文件只抽一次。
 * 抽帧失败不重试、不刷屏——调用方把它当作"这一行没有图"处理即可。
 */
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import {
  thumbnailCacheKey,
  thumbnailPath,
  thumbnailSeekSeconds,
  type CachePaths,
} from '../../src/lib/thumbnail-cache';

export interface ThumbnailResult {
  path: string;
  fromCache: boolean;
}

const THUMB_ARGS = (videoPath: string, seek: number, target: string): string[] => [
  '-hide_banner',
  '-loglevel',
  'error',
  // -ss 放在 -i 之前是快取：按关键帧定位，不用从头解码
  '-ss',
  String(seek),
  '-i',
  videoPath,
  '-frames:v',
  '1',
  '-vf',
  'scale=480:-2',
  '-q:v',
  '3',
  '-y',
  target,
];

export function ensureThumbnail(
  ffmpegPath: string,
  videoPath: string,
  durationSec: number | null,
  paths: CachePaths,
): Promise<ThumbnailResult> {
  if (!existsSync(videoPath)) {
    return Promise.reject(new Error(`视频文件不存在：${videoPath}`));
  }

  const stats = statSync(videoPath);
  const key = thumbnailCacheKey({ path: videoPath, mtimeMs: stats.mtimeMs, sizeBytes: stats.size });
  const target = thumbnailPath(paths, key);

  if (existsSync(target)) {
    return Promise.resolve({ path: target, fromCache: true });
  }

  mkdirSync(paths.cacheDir, { recursive: true });
  const seek = thumbnailSeekSeconds(durationSec);

  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath,
      THUMB_ARGS(videoPath, seek, target),
      { encoding: 'utf8', timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error || !existsSync(target)) {
          reject(
            new Error(`抽帧失败：${stderr?.trim() || error?.message || '没有产出缩略图'}`),
          );
          return;
        }
        resolve({ path: target, fromCache: false });
      },
    );
  });
}
