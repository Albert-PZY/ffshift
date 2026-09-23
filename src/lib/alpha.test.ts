import { describe, expect, it } from 'vitest';
import { hasAlphaChannel, parseMediaInfo } from './ffprobe';

const meta = { path: 'D:\\素材\\片段.mov', sizeBytes: 1024 };

const base = {
  streams: [
    { codec_type: 'video', codec_name: 'h264', width: 1280, height: 720, r_frame_rate: '30/1' },
    { codec_type: 'audio', codec_name: 'aac', channels: 2 },
  ],
  format: { duration: '10', format_name: 'mov,mp4,m4a,3gp,3g2,mj2' },
};

describe('hasAlphaChannel', () => {
  it('带透明通道的像素格式认得出', () => {
    for (const format of ['rgba', 'argb', 'bgra', 'abgr', 'yuva420p', 'yuva422p', 'yuva420p10le', 'ya8']) {
      expect(hasAlphaChannel(format)).toBe(true);
    }
  });

  it('普通像素格式不带透明通道', () => {
    for (const format of ['yuv420p', 'yuvj420p', 'nv12', 'rgb24', 'gray']) {
      expect(hasAlphaChannel(format)).toBe(false);
    }
  });

  it('缺失或空值时按不带处理', () => {
    expect(hasAlphaChannel(null)).toBe(false);
    expect(hasAlphaChannel(undefined)).toBe(false);
    expect(hasAlphaChannel('')).toBe(false);
  });
});

describe('parseMediaInfo 的像素格式', () => {
  it('读出 pix_fmt 并判断透明通道', () => {
    const withAlpha = {
      ...base,
      streams: [{ ...base.streams[0], pix_fmt: 'rgba' }, base.streams[1]],
    };
    const info = parseMediaInfo(withAlpha, meta);
    expect(info.pixelFormat).toBe('rgba');
    expect(info.hasAlpha).toBe(true);
  });

  it('普通视频不带透明通道', () => {
    const normal = {
      ...base,
      streams: [{ ...base.streams[0], pix_fmt: 'yuv420p' }, base.streams[1]],
    };
    expect(parseMediaInfo(normal, meta).hasAlpha).toBe(false);
  });

  it('没有视频流时像素格式为空', () => {
    const audioOnly = {
      streams: [{ codec_type: 'audio', codec_name: 'mp3' }],
      format: { duration: '30', format_name: 'mp3' },
    };
    const info = parseMediaInfo(audioOnly, meta);
    expect(info.pixelFormat).toBeNull();
    expect(info.hasAlpha).toBe(false);
  });
});
