import { describe, expect, it } from 'vitest';
import { shortFfmpegVersion } from './ffmpeg-version';

describe('shortFfmpegVersion', () => {
  it('从真实版本串里只取版本号', () => {
    expect(
      shortFfmpegVersion(
        'ffmpeg version 9.0.2-essentials_build-www.gyan.dev Copyright (c) 2000-2026 the FFmpeg developers',
      ),
    ).toBe('ffmpeg 9.0.2');
  });

  it('构建标签与编解码库后缀都丢掉', () => {
    expect(shortFfmpegVersion('ffmpeg version 7.1.1-full_build-www.gyan.dev')).toBe('ffmpeg 7.1.1');
    expect(shortFfmpegVersion('ffmpeg version 6.1')).toBe('ffmpeg 6.1');
  });

  it('git 构建的 n7.0 这种前缀也能取出版本号', () => {
    expect(shortFfmpegVersion('ffmpeg version n7.0 Copyright (c) 2000-2024 the FFmpeg developers')).toBe('ffmpeg 7.0');
  });

  it('不在整条串里搜数字：版权年份不是版本号', () => {
    expect(shortFfmpegVersion('ffmpeg version unknown Copyright (c) 2000-2026')).toBe('未检测到 ffmpeg');
  });

  it('认不出时给一句人话，不给空字符串', () => {
    expect(shortFfmpegVersion(null)).toBe('未检测到 ffmpeg');
    expect(shortFfmpegVersion('')).toBe('未检测到 ffmpeg');
    expect(shortFfmpegVersion('garbage 2024 line')).toBe('未检测到 ffmpeg');
  });
});
