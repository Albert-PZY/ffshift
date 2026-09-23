import { describe, expect, it } from 'vitest';
import { resolveContainer } from './ffmpeg-args';
import {
  DEFAULT_ADVANCED,
  describeAdvanced,
  isAdvancedEmpty,
  parseAdvanced,
  validateAdvanced,
  validateForFormat,
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

describe('parseAdvanced', () => {
  it('空值与非对象回到全默认，不让坏设置卡住启动', () => {
    expect(parseAdvanced(null)).toEqual(DEFAULT_ADVANCED);
    expect(parseAdvanced(undefined)).toEqual(DEFAULT_ADVANCED);
    expect(parseAdvanced('不是对象')).toEqual(DEFAULT_ADVANCED);
    expect(parseAdvanced([])).toEqual(DEFAULT_ADVANCED);
    expect(parseAdvanced({})).toEqual(DEFAULT_ADVANCED);
  });

  it('合法值原样读回来', () => {
    const stored = base({ crf: 18, videoCodec: 'libx265', scale: '1920x1080', extraArgs: '-movflags +faststart' });
    expect(parseAdvanced(stored)).toEqual(stored);
  });

  it('枚举类字段当白名单用：写了不存在的名字就当没填', () => {
    const parsed = parseAdvanced({ videoCodec: 'libx264_fake', encoderPreset: 'turbo', audioMode: 'transcode' });
    expect(parsed.videoCodec).toBeNull();
    expect(parsed.encoderPreset).toBeNull();
    expect(parsed.audioMode).toBeNull();
  });

  it('一条坏值只毁它自己，其余照常读回来', () => {
    const parsed = parseAdvanced({ crf: 'CRF 是数字', gop: 60, fps: Number.NaN, threads: 4 });
    expect(parsed.crf).toBeNull();
    expect(parsed.fps).toBeNull();
    expect(parsed.gop).toBe(60);
    expect(parsed.threads).toBe(4);
  });

  it('声道只认 1 与 2；采样率只认白名单里的值', () => {
    expect(parseAdvanced({ channels: 1 }).channels).toBe(1);
    expect(parseAdvanced({ channels: 2 }).channels).toBe(2);
    expect(parseAdvanced({ channels: 6 }).channels).toBeNull();
    expect(parseAdvanced({ sampleRate: 44100 }).sampleRate).toBe(44100);
    expect(parseAdvanced({ sampleRate: 12345 }).sampleRate).toBeNull();
    // 界面上传的是字符串，落盘的是数字——两种形状都要认，但只认白名单内的
    expect(parseAdvanced({ sampleRate: '44100' }).sampleRate).toBeNull();
  });

  it('faststart 只认真正的布尔值', () => {
    expect(parseAdvanced({ faststart: false }).faststart).toBe(false);
    expect(parseAdvanced({ faststart: 'true' }).faststart).toBeNull();
  });

  it('空字符串当没填，不留一个空串进 ffmpeg 参数', () => {
    expect(parseAdvanced({ scale: '   ', extraArgs: '' }).scale).toBeNull();
    expect(parseAdvanced({ scale: '   ', extraArgs: '' }).extraArgs).toBeNull();
  });
});

describe('validateForFormat', () => {
  it('按输出格式推导容器，与直接传容器结果一致', () => {
    const params = base({ videoCodec: 'libx264' });
    expect(validateForFormat(params, 'webm').errors).toEqual(validateAdvanced(params, webm).errors);
  });

  it('最常用的那条能拦住：WebM 上选 H.264', () => {
    const result = validateForFormat(base({ videoCodec: 'libx264' }), 'webm');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('WEBM');
  });

  it('保持原格式时按 mp4 兜底，不出错', () => {
    expect(validateForFormat(DEFAULT_ADVANCED, 'same').errors).toHaveLength(0);
  });
});
