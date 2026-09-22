import { describe, expect, it } from 'vitest';
import { computePercent, computeRemaining, parseProgressBlock } from './progress';

/** ffmpeg -progress pipe:1 的真实输出片段 */
const block = [
  'frame=120',
  'fps=25.00',
  'stream_0_0_q=28.0',
  'bitrate=1234.5kbits/s',
  'total_size=10485760',
  'out_time_us=4800000',
  'out_time_ms=4800000',
  'out_time=00:00:04.800000',
  'dup_frames=0',
  'drop_frames=0',
  'speed=1.5x',
  'progress=continue',
].join('\n');

describe('parseProgressBlock', () => {
  it('解析 out_time_us 为秒', () => {
    expect(parseProgressBlock(block).outTimeSec).toBeCloseTo(4.8, 3);
  });

  it('解析 speed，去掉 x 后缀', () => {
    expect(parseProgressBlock(block).speed).toBeCloseTo(1.5, 3);
  });

  it('解析 total_size', () => {
    expect(parseProgressBlock(block).totalSizeBytes).toBe(10485760);
  });

  it('识别结束标记', () => {
    expect(parseProgressBlock('progress=end').done).toBe(true);
    expect(parseProgressBlock(block).done).toBe(false);
  });

  it('speed 为 N/A 时返回 null，而不是 NaN', () => {
    expect(parseProgressBlock('speed=N/A').speed).toBeNull();
  });

  it('字段缺失时返回 null 而不是 0，避免进度条乱跳', () => {
    const p = parseProgressBlock('frame=1\nfps=0.00');
    expect(p.outTimeSec).toBeNull();
    expect(p.speed).toBeNull();
  });

  it('空输入不抛错', () => {
    expect(() => parseProgressBlock('')).not.toThrow();
    expect(parseProgressBlock('').outTimeSec).toBeNull();
  });
});

describe('computePercent', () => {
  it('按时长算百分比', () => {
    expect(computePercent(30, 60)).toBeCloseTo(0.5, 4);
  });

  it('时长未知时返回 null，由界面降级显示', () => {
    expect(computePercent(30, 0)).toBeNull();
    expect(computePercent(30, Number.NaN)).toBeNull();
  });

  it('超过 100% 时收敛，避免进度条越界', () => {
    expect(computePercent(70, 60)).toBe(1);
  });
});

describe('computeRemaining', () => {
  it('按时长与速度估算剩余秒数', () => {
    expect(computeRemaining(30, 60, 1.5)).toBeCloseTo(20, 1);
  });

  it('速度不可用时返回 null', () => {
    expect(computeRemaining(30, 60, null)).toBeNull();
    expect(computeRemaining(30, 60, 0)).toBeNull();
  });

  it('时长未知时返回 null', () => {
    expect(computeRemaining(30, 0, 2)).toBeNull();
  });

  it('已完成时返回 0，不出现负数', () => {
    expect(computeRemaining(60, 60, 2)).toBe(0);
    expect(computeRemaining(70, 60, 2)).toBe(0);
  });
});
