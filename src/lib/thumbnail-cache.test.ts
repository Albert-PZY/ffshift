import { describe, expect, it } from 'vitest';
import {
  hashKey,
  thumbnailCacheKey,
  thumbnailPath,
  thumbnailSeekSeconds,
  type CachePaths,
} from './thumbnail-cache';

const paths: CachePaths = {
  cacheDir: 'C:\\Users\\me\\AppData\\Roaming\\ffshift\\thumbnails',
  logsDir: 'C:\\Users\\me\\AppData\\Roaming\\ffshift\\logs',
};

describe('hashKey', () => {
  it('相同输入得到相同结果', () => {
    expect(hashKey('D:\\a.mp4|1|2')).toBe(hashKey('D:\\a.mp4|1|2'));
  });

  it('只输出十六进制字符，长度固定', () => {
    const key = hashKey('任意内容 with spaces/中文');
    expect(key).toMatch(/^[0-9a-f]{16}$/);
  });

  it('输入有一点不同，结果就不同', () => {
    expect(hashKey('a')).not.toBe(hashKey('b'));
  });
});

describe('thumbnailCacheKey', () => {
  const base = { path: 'D:\\素材\\片子.mp4', mtimeMs: 1700000000000, sizeBytes: 123456 };

  it('同一文件的路径、修改时间、大小不变则键不变', () => {
    expect(thumbnailCacheKey(base)).toBe(thumbnailCacheKey({ ...base }));
  });

  it('修改时间变化后键变化，不会复用旧缩略图', () => {
    expect(thumbnailCacheKey(base)).not.toBe(thumbnailCacheKey({ ...base, mtimeMs: base.mtimeMs + 1 }));
  });

  it('文件被替换（大小变化）后键变化', () => {
    expect(thumbnailCacheKey(base)).not.toBe(thumbnailCacheKey({ ...base, sizeBytes: base.sizeBytes + 1 }));
  });

  it('路径大小写与分隔符差异不影响复用（Windows 同一文件）', () => {
    const upper = thumbnailCacheKey({ ...base, path: 'D:\\素材\\片子.MP4' });
    const lower = thumbnailCacheKey({ ...base, path: 'd:/素材/片子.mp4' });
    expect(upper).toBe(lower);
  });
});

describe('thumbnailPath', () => {
  it('落在缓存目录下，以 jpg 结尾', () => {
    const file = thumbnailPath(paths, 'abc123');
    expect(file.startsWith(paths.cacheDir)).toBe(true);
    expect(file.endsWith('.jpg')).toBe(true);
  });

  it('键不同则文件不同，避免互相覆盖', () => {
    expect(thumbnailPath(paths, 'abc123')).not.toBe(thumbnailPath(paths, 'def456'));
  });
});

describe('thumbnailSeekSeconds', () => {
  it('取时长的 10%，避开片头黑场与台标', () => {
    expect(thumbnailSeekSeconds(10)).toBeCloseTo(1, 3);
    expect(thumbnailSeekSeconds(600)).toBeCloseTo(60, 3);
  });

  it('很短的视频取 0.1 秒，不做超出时长的跳转', () => {
    expect(thumbnailSeekSeconds(0.5)).toBe(0.1);
    expect(thumbnailSeekSeconds(0)).toBe(0.1);
  });

  it('时长未知时取 1 秒这个保守值', () => {
    expect(thumbnailSeekSeconds(null)).toBe(1);
    expect(thumbnailSeekSeconds(Number.NaN)).toBe(1);
  });

  it('结果不超过 60 秒，避免长时间视频每次都从头解码', () => {
    expect(thumbnailSeekSeconds(36000)).toBeLessThanOrEqual(60);
  });
});
