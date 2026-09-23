import { describe, expect, it } from 'vitest';
import { resolveContainer } from './ffmpeg-args';
import {
  DEFAULT_ADVANCED,
  describeAdvanced,
  isAdvancedEmpty,
  validateAdvanced,
  type AdvancedParams,
} from './advanced-params';

const mp4 = resolveContainer('mp4', 'x.mkv');
const mkv = resolveContainer('mkv', 'x.mkv');
const webm = resolveContainer('webm', 'x.mkv');
const gif = resolveContainer('gif', 'x.mkv');

const base = (patch: Partial<AdvancedParams> = {}): AdvancedParams => ({ ...DEFAULT_ADVANCED, ...patch });

describe('isAdvancedEmpty', () => {
  it('全默认时算空', () => {
    expect(isAdvancedEmpty(DEFAULT_ADVANCED)).toBe(true);
  });

  it('动过任何一项就不算空', () => {
    expect(isAdvancedEmpty(base({ crf: 20 }))).toBe(false);
    expect(isAdvancedEmpty(base({ audioMode: 'none' }))).toBe(false);
    expect(isAdvancedEmpty(base({ faststart: false }))).toBe(false);
  });
});

describe('validateAdvanced 的 CRF 范围', () => {
  it('x264 的 CRF 上限是 51', () => {
    expect(validateAdvanced(base({ crf: 18 }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ crf: 51 }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ crf: 52 }), mp4).errors[0]).toMatch(/CRF/);
  });

  it('VP9 的 CRF 上限是 63', () => {
    expect(validateAdvanced(base({ videoCodec: 'libvpx-vp9', crf: 63 }), webm).errors).toHaveLength(0);
    expect(validateAdvanced(base({ videoCodec: 'libvpx-vp9', crf: 64 }), webm).errors[0]).toMatch(/CRF/);
  });

  it('CRF 不能是负的', () => {
    expect(validateAdvanced(base({ crf: -1 }), mp4).errors.length).toBeGreaterThan(0);
  });

  it('不选编码器时按容器的默认编码器判范围', () => {
    // MKV 默认走 libx264（上限 51），WebM 默认走 VP9（上限 63）
    expect(validateAdvanced(base({ crf: 52 }), mkv).errors[0]).toMatch(/CRF/);
    expect(validateAdvanced(base({ crf: 52 }), webm).errors).toHaveLength(0);
  });
});

describe('validateAdvanced 的编码器与容器兼容', () => {
  it('WebM 不接受 H.264', () => {
    expect(validateAdvanced(base({ videoCodec: 'libx264' }), webm).errors[0]).toMatch(/容器|WebM/);
  });

  it('MP4 不接受 VP9', () => {
    expect(validateAdvanced(base({ videoCodec: 'libvpx-vp9' }), mp4).errors.length).toBeGreaterThan(0);
  });

  it('MKV 装得下常见编码', () => {
    expect(validateAdvanced(base({ videoCodec: 'libx265' }), mkv).errors).toHaveLength(0);
    expect(validateAdvanced(base({ videoCodec: 'libvpx-vp9' }), mkv).errors).toHaveLength(0);
  });

  it('GIF 没有可选的视频编码器', () => {
    expect(validateAdvanced(base({ videoCodec: 'libx264' }), gif).errors.length).toBeGreaterThan(0);
  });

  it('硬件编码器按系族判断，不看具体实现', () => {
    expect(validateAdvanced(base({ videoCodec: 'h264_nvenc' }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ videoCodec: 'hevc_qsv' }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ videoCodec: 'h264_nvenc' }), webm).errors.length).toBeGreaterThan(0);
  });
});

describe('validateAdvanced 的编码选项', () => {
  it('编码速度预设只认 x264/x265 那几档', () => {
    expect(validateAdvanced(base({ encoderPreset: 'slow' }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ encoderPreset: 'turbo' }), mp4).errors[0]).toMatch(/速度/);
  });

  it('tune 与 profile 只在支持的编码器上给值', () => {
    expect(validateAdvanced(base({ tune: 'film' }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ tune: '电影' }), mp4).errors.length).toBeGreaterThan(0);
    expect(validateAdvanced(base({ profile: 'high' }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ profile: '超高' }), mp4).errors.length).toBeGreaterThan(0);
  });

  it('像素格式按白名单', () => {
    expect(validateAdvanced(base({ pixelFormat: 'yuv420p' }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ pixelFormat: 'yuv420p10le' }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ pixelFormat: '乱写' }), mp4).errors.length).toBeGreaterThan(0);
  });

  it('关键帧间隔在 1-600 之间', () => {
    expect(validateAdvanced(base({ gop: 60 }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ gop: 0 }), mp4).errors.length).toBeGreaterThan(0);
    expect(validateAdvanced(base({ gop: 5000 }), mp4).errors.length).toBeGreaterThan(0);
  });
});

describe('validateAdvanced 的画面选项', () => {
  it('缩放要写成 宽x高，且在合理分辨率内', () => {
    expect(validateAdvanced(base({ scale: '1920x1080' }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ scale: '1920*1080' }), mp4).errors.length).toBeGreaterThan(0);
    expect(validateAdvanced(base({ scale: '10000x10000' }), mp4).errors.length).toBeGreaterThan(0);
  });

  it('帧率在 1-240 之间', () => {
    expect(validateAdvanced(base({ fps: 30 }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ fps: 0 }), mp4).errors.length).toBeGreaterThan(0);
    expect(validateAdvanced(base({ fps: 500 }), mp4).errors.length).toBeGreaterThan(0);
  });

  it('缩放算法按白名单', () => {
    expect(validateAdvanced(base({ scaleAlgorithm: 'lanczos' }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ scaleAlgorithm: 'magic' as never }), mp4).errors.length).toBeGreaterThan(0);
  });
});

describe('validateAdvanced 的音频选项', () => {
  it('音频码率与采样率有范围', () => {
    expect(validateAdvanced(base({ audioBitrateKbps: 192 }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ audioBitrateKbps: 5 }), mp4).errors.length).toBeGreaterThan(0);
    expect(validateAdvanced(base({ sampleRate: 48000 }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ sampleRate: 1000 }), mp4).errors.length).toBeGreaterThan(0);
  });

  it('无损音频格式上设码率会给出提示', () => {
    const result = validateAdvanced(base({ audioCodec: 'flac', audioBitrateKbps: 320 }), mp4);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.join(' ')).toMatch(/无损|码率/);
  });

  it('移除音轨时再选编码器会给出提示', () => {
    const result = validateAdvanced(base({ audioMode: 'none', audioCodec: 'aac' }), mp4);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('validateAdvanced 的额外参数', () => {
  it('允许常见的附加开关', () => {
    expect(validateAdvanced(base({ extraArgs: '-movflags +faststart' }), mp4).errors).toHaveLength(0);
    expect(validateAdvanced(base({ extraArgs: '-tune fastdecode' }), mp4).errors).toHaveLength(0);
  });

  it('拦下会改写输入输出的危险参数', () => {
    for (const dangerous of ['-i other.mp4', '-y', '-filter_complex scale=1:1', '-c:v libx264', 'out.mp4']) {
      expect(validateAdvanced(base({ extraArgs: dangerous }), mp4).errors.length, dangerous).toBeGreaterThan(0);
    }
  });

  it('空字符串按未填处理', () => {
    expect(validateAdvanced(base({ extraArgs: '   ' }), mp4).errors).toHaveLength(0);
  });
});

describe('describeAdvanced', () => {
  it('把设置的项总结成人话', () => {
    const text = describeAdvanced(base({ crf: 18, encoderPreset: 'slow', audioMode: 'none' })).join(' ');
    expect(text).toContain('CRF 18');
    expect(text).toContain('slow');
    expect(text).toContain('移除音轨');
  });

  it('全默认时没有摘要', () => {
    expect(describeAdvanced(DEFAULT_ADVANCED)).toHaveLength(0);
  });

  it('缩放与帧率会一起写在画面一项里', () => {
    const text = describeAdvanced(base({ scale: '1280x720', fps: 30 })).join(' ');
    expect(text).toContain('1280x720');
    expect(text).toContain('30');
  });
});
