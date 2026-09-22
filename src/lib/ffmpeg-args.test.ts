import { describe, expect, it } from 'vitest';
import { buildArgs, estimateVideoBitrateKbps, suggestOutputPath } from './ffmpeg-args';

const base = {
  input: 'D:\\素材\\中文 名字.mp4',
  output: 'D:\\输出\\中文 名字.ffshift.mp4',
};

describe('buildArgs', () => {
  it('均衡档：H.264 CRF 21 + AAC 128k + faststart', () => {
    const args = buildArgs({ ...base, preset: 'balanced', hasAudio: true });
    expect(args).toContain('-c:v');
    expect(args[args.indexOf('-c:v') + 1]).toBe('libx264');
    expect(args[args.indexOf('-crf') + 1]).toBe('21');
    expect(args[args.indexOf('-preset') + 1]).toBe('medium');
    expect(args[args.indexOf('-c:a') + 1]).toBe('aac');
    expect(args[args.indexOf('-b:a') + 1]).toBe('128k');
    expect(args).toContain('+faststart');
  });

  it('更清晰档：CRF 更低、preset 更慢、音频更高', () => {
    const args = buildArgs({ ...base, preset: 'clear', hasAudio: true });
    expect(Number(args[args.indexOf('-crf') + 1])).toBeLessThanOrEqual(20);
    expect(args[args.indexOf('-preset') + 1]).toBe('slow');
    expect(args[args.indexOf('-b:a') + 1]).toBe('192k');
  });

  it('更小档：H.265 + CRF 26 + 音频 96k', () => {
    const args = buildArgs({ ...base, preset: 'small', hasAudio: true });
    expect(args[args.indexOf('-c:v') + 1]).toBe('libx265');
    expect(args[args.indexOf('-crf') + 1]).toBe('26');
    expect(args[args.indexOf('-b:a') + 1]).toBe('96k');
  });

  it('无音轨时不加任何音频参数，避免 ffmpeg 报错', () => {
    const args = buildArgs({ ...base, preset: 'balanced', hasAudio: false });
    expect(args).not.toContain('-c:a');
    expect(args).not.toContain('-b:a');
  });

  it('始终带覆盖、静默横幅与结构化进度（进度靠 stdout 解析）', () => {
    const args = buildArgs({ ...base, preset: 'balanced', hasAudio: true });
    expect(args).toContain('-y');
    expect(args).toContain('-hide_banner');
    expect(args).toContain('-progress');
    expect(args[args.indexOf('-progress') + 1]).toBe('pipe:1');
    expect(args).toContain('-nostats');
  });

  it('输入输出按数组传参，中文与空格原样保留（不做 shell 转义）', () => {
    const args = buildArgs({ ...base, preset: 'balanced', hasAudio: true });
    expect(args).toContain(base.input);
    expect(args).toContain(base.output);
    expect(args.at(-1)).toBe(base.output);
  });

  it('硬件加速：用 nvenc 编码器并以 cq 代替 crf', () => {
    const args = buildArgs({ ...base, preset: 'balanced', hw: 'nvenc', hasAudio: true });
    expect(args[args.indexOf('-c:v') + 1]).toBe('h264_nvenc');
    expect(args).toContain('-cq');
    expect(args).not.toContain('-crf');
  });

  it('硬件加速 + 更小档时用 hevc 编码器', () => {
    const args = buildArgs({ ...base, preset: 'small', hw: 'qsv', hasAudio: true });
    expect(args[args.indexOf('-c:v') + 1]).toBe('hevc_qsv');
  });

  it('指定目标体积时改用码率模式，并按体积反推视频码率', () => {
    const args = buildArgs({
      ...base,
      preset: 'balanced',
      hasAudio: true,
      targetSizeMiB: 50,
      durationSec: 300,
    });
    expect(args).toContain('-b:v');
    expect(args).not.toContain('-crf');
    const bitrateArg = args[args.indexOf('-b:v') + 1] ?? '';
    const kbps = Number(bitrateArg.replace('k', ''));
    // 8192 * 50 / 300 - 128 ≈ 1237
    expect(kbps).toBeGreaterThan(1200);
    expect(kbps).toBeLessThan(1270);
  });

  it('目标体积缺少时长时明确报错，而不是悄悄算错', () => {
    expect(() =>
      buildArgs({ ...base, preset: 'balanced', hasAudio: true, targetSizeMiB: 50 }),
    ).toThrow(/需要时长/);
  });
});

describe('estimateVideoBitrateKbps', () => {
  it('按目标体积与时长反推，并扣掉音频码率', () => {
    // 8192 * 100 / 600 - 128 ≈ 1237
    expect(estimateVideoBitrateKbps(100, 600, 128)).toBe(1237);
  });

  it('结果过低时保底，避免产出不可看的视频', () => {
    expect(estimateVideoBitrateKbps(1, 7200, 128)).toBeGreaterThanOrEqual(100);
  });
});

describe('suggestOutputPath', () => {
  it('保留原目录与原扩展名，插入 .ffshift 后缀', () => {
    expect(suggestOutputPath('D:\\素材\\片段.mov')).toBe('D:\\素材\\片段.ffshift.mov');
  });

  it('无扩展名时也能给出结果', () => {
    expect(suggestOutputPath('D:\\素材\\无名')).toBe('D:\\素材\\无名.ffshift.mp4');
  });

  it('不覆盖原文件：输出路径一定不同于输入', () => {
    const input = 'D:\\素材\\片段.mp4';
    expect(suggestOutputPath(input)).not.toBe(input);
  });
});
