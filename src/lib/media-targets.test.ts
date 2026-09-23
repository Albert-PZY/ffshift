import { describe, expect, it } from 'vitest';
import { buildArgs, type ConvertOptions } from './ffmpeg-args';

const base = { input: 'D:\\素材\\片段.mp4', output: 'D:\\素材\\片段.ffshift', preset: 'balanced' as const };

/** 参数里某个开关后面跟的值 */
const after = (args: string[], flag: string): string | undefined => args[args.indexOf(flag) + 1];

describe('音频输出（提取音轨）', () => {
  const audioCase = (format: 'mp3' | 'm4a' | 'opus' | 'flac' | 'wav'): ConvertOptions => ({
    ...base,
    output: `D:\\素材\\片段.ffshift.${format}`,
    format,
    hasAudio: true,
  });

  it('mp3 用 VBR 质量参数，不用固定码率', () => {
    const args = buildArgs(audioCase('mp3'));
    expect(after(args, '-c:a')).toBe('libmp3lame');
    expect(args).toContain('-q:a');
    expect(args).not.toContain('-b:a');
  });

  it('m4a 用 AAC 192k', () => {
    const args = buildArgs(audioCase('m4a'));
    expect(after(args, '-c:a')).toBe('aac');
    expect(after(args, '-b:a')).toBe('192k');
  });

  it('opus 用 libopus 160k', () => {
    const args = buildArgs(audioCase('opus'));
    expect(after(args, '-c:a')).toBe('libopus');
    expect(after(args, '-b:a')).toBe('160k');
  });

  it('flac 与 wav 用无损编码，不带码率参数', () => {
    const flac = buildArgs(audioCase('flac'));
    expect(after(flac, '-c:a')).toBe('flac');
    expect(flac).not.toContain('-b:a');
    expect(flac).not.toContain('-q:a');

    const wav = buildArgs(audioCase('wav'));
    expect(after(wav, '-c:a')).toBe('pcm_s16le');
  });

  it('音频目标一律丢弃视频轨，也不带视频编码参数', () => {
    for (const format of ['mp3', 'm4a', 'opus', 'flac', 'wav'] as const) {
      const args = buildArgs(audioCase(format));
      expect(args).toContain('-vn');
      expect(args).not.toContain('-c:v');
      expect(args).not.toContain('-crf');
    }
  });

  it('源文件没有音轨时明确报错，而不是产出一个空文件', () => {
    expect(() => buildArgs({ ...audioCase('mp3'), hasAudio: false })).toThrow(/没有音频/);
  });

  it('指定目标体积时，音频码率按体积与时长算', () => {
    const args = buildArgs({ ...audioCase('m4a'), targetSizeMiB: 5, durationSec: 300 });
    expect(args).toContain('-b:a');
    // 8192 × 5 ÷ 300 ≈ 136 kbps
    const kbps = Number((after(args, '-b:a') ?? '').replace('k', ''));
    expect(kbps).toBeGreaterThan(100);
    expect(kbps).toBeLessThan(200);
  });
});

describe('GIF 输出', () => {
  const gifCase: ConvertOptions = { ...base, output: 'D:\\素材\\片段.ffshift.gif', format: 'gif', hasAudio: true };

  it('用调色板两遍法，而不是直接编码', () => {
    const args = buildArgs(gifCase);
    const filterIndex = args.indexOf('-vf');
    const filter = args[filterIndex + 1] ?? '';
    expect(filter).toContain('palettegen');
    expect(filter).toContain('paletteuse');
    expect(filter).toContain('scale');
  });

  it('循环播放且不带音频', () => {
    const args = buildArgs(gifCase);
    expect(after(args, '-loop')).toBe('0');
    expect(args).not.toContain('-c:a');
    expect(args).not.toContain('-b:a');
  });

  it('不用硬件编码器', () => {
    const args = buildArgs({ ...gifCase, hw: 'nvenc' });
    expect(args).not.toContain('h264_nvenc');
    expect(args).toContain('-vf');
  });
});

describe('Alpha 通道合成', () => {
  const alphaSource = { width: 1280, height: 720, fps: 30, hasAlpha: true };
  const opaqueSource = { width: 1280, height: 720, fps: 30, hasAlpha: false };

  it('带透明通道的源转视频时，先合成底色再编码', () => {
    const args = buildArgs({ ...base, output: 'D:\\素材\\片段.ffshift.mp4', format: 'mp4', source: alphaSource });
    expect(args).toContain('-f');
    expect(after(args, '-f')).toBe('lavfi');
    expect(args).toContain('-filter_complex');
    expect(args[args.indexOf('-filter_complex') + 1]).toContain('overlay');
    expect(args).toContain('-map');
    expect(args.join(' ')).toContain('color=');
  });

  it('不带透明通道的源不加合成，避免多解码一路', () => {
    const args = buildArgs({ ...base, output: 'D:\\素材\\片段.ffshift.mp4', format: 'mp4', source: opaqueSource });
    expect(args).not.toContain('-filter_complex');
    expect(args).not.toContain('lavfi');
  });

  it('有音轨时合成后仍保留音频', () => {
    const args = buildArgs({
      ...base,
      output: 'D:\\素材\\片段.ffshift.mp4',
      format: 'mp4',
      source: alphaSource,
      hasAudio: true,
    });
    expect(args).toContain('0:a?');
  });

  it('音频目标不做 alpha 合成（没有视频轨）', () => {
    const args = buildArgs({
      ...base,
      output: 'D:\\素材\\片段.ffshift.mp3',
      format: 'mp3',
      hasAudio: true,
      source: alphaSource,
    });
    expect(args).not.toContain('-filter_complex');
  });

  it('合成尺寸与帧率取源参数，缺失时给安全默认值', () => {
    const args = buildArgs({
      ...base,
      output: 'D:\\素材\\片段.ffshift.mp4',
      format: 'mp4',
      source: { width: null, height: null, fps: null, hasAlpha: true },
    });
    // 底色输入排在 -f lavfi 之后
    const colorInput = args[args.indexOf('-i', args.indexOf('-f')) + 1] ?? '';
    expect(colorInput).toMatch(/1280x720/);
    expect(colorInput).toMatch(/r=30/);
  });
});
