import { describe, expect, it } from 'vitest';
import { buildArgs, outputPathFor, resolveContainer, type OutputFormat } from './ffmpeg-args';

const base = { input: 'D:\\素材\\片段.mkv', hasAudio: true };

describe('resolveContainer', () => {
  it('same 跟随输入扩展名', () => {
    expect(resolveContainer('same', 'D:\\素材\\片段.mkv').extension).toBe('mkv');
    expect(resolveContainer('same', 'D:\\素材\\片段.MP4').extension).toBe('mp4');
    expect(resolveContainer('same', 'D:\\素材\\无名').extension).toBe('mp4');
  });

  it('指定格式时用目标容器', () => {
    expect(resolveContainer('mp4', 'x.mkv').extension).toBe('mp4');
    expect(resolveContainer('webm', 'x.mkv').extension).toBe('webm');
  });

  it('WebM 用 VP9 + Opus：容器只认这几个编码，写别的直接失败', () => {
    const webm = resolveContainer('webm', 'x.mkv');
    expect(webm.videoCodec('balanced')).toMatch(/vp9|av1/);
    expect(webm.audioCodec).toBe('libopus');
    expect(webm.muxerArgs).toHaveLength(0);
  });

  it('MP4/MOV 加 faststart，让播放器边下边播', () => {
    expect(resolveContainer('mp4', 'x.mkv').muxerArgs).toContain('+faststart');
    expect(resolveContainer('mov', 'x.mkv').muxerArgs).toContain('+faststart');
  });

  it('Matroska 不加 movflags：它不是 MP4 家族的选项，加了也是被忽略', () => {
    expect(resolveContainer('mkv', 'x.mp4').muxerArgs).toHaveLength(0);
  });

  it('保持原格式且原格式是 webm 时，同样走 VP9 而不是 H.264', () => {
    const same = resolveContainer('same', 'D:\\素材\\网页.webm');
    expect(same.extension).toBe('webm');
    expect(same.videoCodec('balanced')).toMatch(/vp9/);
  });

  it('更小档在 MP4/MKV 里换成 H.265', () => {
    expect(resolveContainer('mp4', 'x.mov').videoCodec('small')).toBe('libx265');
    expect(resolveContainer('balanced' as never, 'x.mov').videoCodec('small')).toBe('libx265');
  });

  it('输出扩展名与格式参数打架时，听输出扩展名的', () => {
    // ffmpeg 按输出文件名选 muxer；参数必须跟它一致，否则会写进不接受的容器
    const byOutput = resolveContainer('same', 'D:\\素材\\片段.mp4', 'D:\\素材\\片段.ffshift.webm');
    expect(byOutput.extension).toBe('webm');
    expect(byOutput.videoCodec('balanced')).toMatch(/vp9/);
  });

  it('输出扩展名认不出来时，回到格式参数', () => {
    expect(resolveContainer('mp4', 'D:\\素材\\片段.mkv', 'D:\\素材\\输出').extension).toBe('mp4');
  });
});

describe('buildArgs 的输出格式', () => {
  it('默认行为不变：跟随输入扩展名，MP4 家族才带 faststart', () => {
    const args = buildArgs({ ...base, output: 'D:\\素材\\片段.ffshift.mkv', preset: 'balanced' });
    expect(args).not.toContain('+faststart');
    expect(args.at(-1)).toBe('D:\\素材\\片段.ffshift.mkv');
  });

  it('转成 MP4 时用 H.264 + AAC 并带 faststart', () => {
    const args = buildArgs({
      ...base,
      output: 'D:\\素材\\片段.ffshift.mp4',
      preset: 'balanced',
      format: 'mp4',
    });
    expect(args[args.indexOf('-c:v') + 1]).toBe('libx264');
    expect(args[args.indexOf('-c:a') + 1]).toBe('aac');
    expect(args).toContain('+faststart');
  });

  it('webm 源转成 mp4：不再落到 VP9，而是换成 MP4 能装的编码', () => {
    const args = buildArgs({
      input: 'D:\\素材\\网页.webm',
      output: 'D:\\素材\\网页.ffshift.mp4',
      preset: 'balanced',
      format: 'mp4',
      hasAudio: true,
    });
    expect(args[args.indexOf('-c:v') + 1]).toBe('libx264');
    expect(args[args.indexOf('-c:a') + 1]).toBe('aac');
  });

  it('转成 webm：编码换成 VP9 + Opus，且不带 faststart', () => {
    const args = buildArgs({
      ...base,
      output: 'D:\\素材\\片段.ffshift.webm',
      preset: 'balanced',
      format: 'webm',
    });
    expect(args[args.indexOf('-c:v') + 1]).toBe('libvpx-vp9');
    expect(args[args.indexOf('-c:a') + 1]).toBe('libopus');
    expect(args).not.toContain('+faststart');
  });

  it('webm 输出仍然听硬件加速的话就没法用：硬编不支持 VP9 时回退软编', () => {
    const args = buildArgs({
      ...base,
      output: 'D:\\素材\\片段.ffshift.webm',
      preset: 'balanced',
      format: 'webm',
      hw: 'nvenc',
    });
    expect(args[args.indexOf('-c:v') + 1]).toBe('libvpx-vp9');
  });

  it('无音轨时任何目标格式都不带音频参数', () => {
    for (const format of ['same', 'mp4', 'mkv', 'mov', 'webm'] as OutputFormat[]) {
      const args = buildArgs({ ...base, output: `out.${format}`, preset: 'balanced', format, hasAudio: false });
      expect(args).not.toContain('-c:a');
    }
  });
});

describe('outputPathFor', () => {
  it('替换扩展名，不动目录与主文件名', () => {
    expect(outputPathFor('D:\\素材\\片段.mkv', 'mp4')).toBe('D:\\素材\\片段.ffshift.mp4');
    expect(outputPathFor('D:\\素材\\片段.mov', 'webm')).toBe('D:\\素材\\片段.ffshift.webm');
  });

  it('same 保留原扩展名', () => {
    expect(outputPathFor('D:\\素材\\片段.mkv', 'same')).toBe('D:\\素材\\片段.ffshift.mkv');
  });

  it('原文件没有扩展名时给出默认扩展名', () => {
    expect(outputPathFor('D:\\素材\\无名', 'same')).toBe('D:\\素材\\无名.ffshift.mp4');
    expect(outputPathFor('D:\\素材\\无名', 'webm')).toBe('D:\\素材\\无名.ffshift.webm');
  });

  it('目标格式与源相同也不会覆盖源文件', () => {
    const input = 'D:\\素材\\片段.mp4';
    expect(outputPathFor(input, 'mp4')).not.toBe(input);
  });

  it('目录名里的点不会被当扩展名', () => {
    expect(outputPathFor('D:\\我的 素材.v2\\片段', 'mkv')).toBe('D:\\我的 素材.v2\\片段.ffshift.mkv');
  });
});
