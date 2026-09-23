import { describe, expect, it } from 'vitest';
import { DEFAULT_ADVANCED, type AdvancedParams } from './advanced-params';
import { buildArgs, type ConvertOptions } from './ffmpeg-args';

const base: ConvertOptions = {
  input: 'D:\\素材\\片段.mkv',
  output: 'D:\\素材\\片段.ffshift.mp4',
  preset: 'balanced',
  format: 'mp4',
  hasAudio: true,
};

const withAdvanced = (patch: Partial<AdvancedParams>, extra: Partial<ConvertOptions> = {}) =>
  buildArgs({ ...base, ...extra, advanced: { ...DEFAULT_ADVANCED, ...patch } });

const after = (args: string[], flag: string): string | undefined => args[args.indexOf(flag) + 1];

describe('不填专业参数时行为不变', () => {
  it('与没有 advanced 字段时产出的参数一致', () => {
    const plain = buildArgs(base);
    const empty = buildArgs({ ...base, advanced: DEFAULT_ADVANCED });
    expect(empty).toEqual(plain);
  });
});

describe('视频编码参数', () => {
  it('CRF 覆盖档位给的默认质量', () => {
    const args = withAdvanced({ crf: 30 });
    expect(after(args, '-crf')).toBe('30');
    // 档位里的 preset 仍在，只是质量被接管
    expect(after(args, '-preset')).toBe('medium');
  });

  it('目标码率接管恒定质量模式', () => {
    const args = withAdvanced({ rateControl: 'bitrate', videoBitrateKbps: 4000 });
    expect(after(args, '-b:v')).toBe('4000k');
    expect(args).not.toContain('-crf');
  });

  it('编码器覆盖容器默认选的那个', () => {
    const args = withAdvanced({ videoCodec: 'libx265' });
    expect(after(args, '-c:v')).toBe('libx265');
  });

  it('编码速度、tune、profile、像素格式、关键帧间隔都进参数', () => {
    const args = withAdvanced({
      encoderPreset: 'slow',
      tune: 'film',
      profile: 'high',
      pixelFormat: 'yuv420p10le',
      gop: 120,
    });
    expect(after(args, '-preset')).toBe('slow');
    expect(after(args, '-tune')).toBe('film');
    expect(after(args, '-profile:v')).toBe('high');
    expect(after(args, '-pix_fmt')).toBe('yuv420p10le');
    expect(after(args, '-g')).toBe('120');
  });
});

describe('画面参数', () => {
  it('缩放与帧率合成一条滤镜链', () => {
    const args = withAdvanced({ scale: '1280x720', fps: 30, scaleAlgorithm: 'lanczos' });
    const filter = after(args, '-vf') ?? '';
    expect(filter).toContain('scale=1280x720');
    expect(filter).toContain('flags=lanczos');
    expect(filter).toContain('fps=30');
  });

  it('只设缩放时也带默认算法，ffmpeg 才不会挑到最差的那个', () => {
    const filter = after(withAdvanced({ scale: '640x360' }), '-vf') ?? '';
    expect(filter).toContain('scale=640x360');
    expect(filter).toContain('flags=bicubic');
  });

  it('带透明通道的源要合成底色时，滤镜并进 filter_complex 而不是 -vf', () => {
    const source = { width: 1280, height: 720, fps: 30, hasAlpha: true };
    const args = withAdvanced({ scale: '640x360' }, { source });
    expect(args).not.toContain('-vf');

    const graph = after(args, '-filter_complex') ?? '';
    expect(graph).toContain('scale=640x360');
    expect(graph).toContain('overlay');
  });
});

describe('音频参数', () => {
  it('默认仍然按档位重编码', () => {
    const args = withAdvanced({});
    expect(after(args, '-c:a')).toBe('aac');
    expect(after(args, '-b:a')).toBe('128k');
  });

  it('移除音轨用 -an，且不带任何音频编码参数', () => {
    const args = withAdvanced({ audioMode: 'none' });
    expect(args).toContain('-an');
    expect(args).not.toContain('-c:a');
    expect(args).not.toContain('-b:a');
  });

  it('音频保持原样用 -c:a copy', () => {
    const args = withAdvanced({ audioMode: 'copy' });
    expect(after(args, '-c:a')).toBe('copy');
    expect(args).not.toContain('-b:a');
  });

  it('指定编码器、码率、采样率与声道', () => {
    const args = withAdvanced({
      audioMode: 'encode',
      audioCodec: 'libopus',
      audioBitrateKbps: 96,
      sampleRate: 48000,
      channels: 1,
    });
    expect(after(args, '-c:a')).toBe('libopus');
    expect(after(args, '-b:a')).toBe('96k');
    expect(after(args, '-ar')).toBe('48000');
    expect(after(args, '-ac')).toBe('1');
  });
});

describe('容器与其它参数', () => {
  it('关掉 faststart 时把 movflags 整对删掉，不留孤立的开关', () => {
    const args = withAdvanced({ faststart: false });
    expect(args).not.toContain('-movflags');
    expect(args).not.toContain('+faststart');
  });

  it('在线程数指定时带上 -threads', () => {
    expect(after(withAdvanced({ threads: 4 }), '-threads')).toBe('4');
  });

  it('额外参数按空格拆开后原样追加', () => {
    const args = withAdvanced({ extraArgs: '-movflags +faststart -max_muxing_queue_size 1024' });
    expect(args).toContain('-max_muxing_queue_size');
    expect(args).toContain('1024');
  });
});

describe('音频容器上的专业参数', () => {
  it('转音频时只带音频参数，不带视频编码选项', () => {
    const args = buildArgs({
      ...base,
      output: 'D:\\素材\\片段.ffshift.mp3',
      format: 'mp3',
      advanced: { ...DEFAULT_ADVANCED, audioBitrateKbps: 256, sampleRate: 44100 },
    });
    expect(args).toContain('-vn');
    expect(args).not.toContain('-c:v');
    expect(after(args, '-b:a')).toBe('256k');
    expect(after(args, '-ar')).toBe('44100');
  });
});
