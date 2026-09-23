import { describe, expect, it } from 'vitest';
import { translateError } from './errors';

describe('translateError', () => {
  it('找不到输入文件', () => {
    const raw =
      '[in#0 @ 0x1] Error opening input: No such file or directory\nError opening input file x.mp4.';
    const result = translateError(raw, 1);
    expect(result.kind).toBe('input-missing');
    expect(result.title).toMatch(/找不到/);
    expect(result.hint.length).toBeGreaterThan(0);
  });

  it('文件损坏或无法解析', () => {
    const result = translateError('moov atom not found\nInvalid data found when processing input', 1);
    expect(result.kind).toBe('corrupt');
    expect(result.title).toMatch(/损坏|无法解析/);
  });

  it('输出位置不可写', () => {
    const result = translateError('Error opening output file out.mp4.\nPermission denied', 1);
    expect(result.kind).toBe('output-permission');
    expect(result.title).toMatch(/写入/);
  });

  it('输出目录不存在时不要误判成找不到输入文件', () => {
    const raw =
      '[out#0/mp4 @ 0x1] Error opening output D:\\没有这个目录\\out.mp4: No such file or directory\n' +
      'Error opening output file D:\\没有这个目录\\out.mp4.\n' +
      'Error opening output files: No such file or directory';
    const result = translateError(raw, 1);
    expect(result.kind).toBe('output-permission');
    expect(result.title).toMatch(/输出/);
  });

  it('磁盘空间不足', () => {
    const result = translateError('av_interleaved_write_frame(): No space left on device', 1);
    expect(result.kind).toBe('disk-full');
    expect(result.title).toMatch(/空间/);
  });

  it('编码器在这台机器上不可用', () => {
    const result = translateError("Unknown encoder 'h264_nvenc'", 1);
    expect(result.kind).toBe('encoder');
    expect(result.title).toMatch(/编码器/);
  });

  it('被取消的任务给出取消说明，而不是当成失败', () => {
    const result = translateError('', 255);
    expect(result.kind).toBe('cancelled');
    expect(result.title).toMatch(/取消/);
  });

  it('未知错误兜底：保留原始输出供展开查看', () => {
    const result = translateError('some weird failure happened', 1);
    expect(result.kind).toBe('unknown');
    expect(result.title.length).toBeGreaterThan(0);
    expect(result.raw).toContain('weird');
  });

  it('原始输出只保留末尾若干行，避免撑爆界面', () => {
    const noisy = Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\n');
    const result = translateError(noisy, 1);
    expect(result.raw.split('\n').length).toBeLessThanOrEqual(10);
    expect(result.raw).toContain('line 59');
  });
});
