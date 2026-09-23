import { describe, expect, it } from 'vitest';
import {
  ProgressChunker,
  computePercent,
  computeRemaining,
  parseDurationFromStderr,
  parseProgressBlock,
} from './progress';

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

describe('ProgressChunker', () => {
  const blockA = 'frame=1\nout_time_us=1000000\nspeed=1.0x\nprogress=continue\n';
  const blockB = 'frame=2\nout_time_us=2000000\nspeed=1.2x\nprogress=end\n';

  it('一次推送里含两个完整块时返回两个', () => {
    const chunker = new ProgressChunker();
    expect(chunker.push(blockA + blockB)).toHaveLength(2);
  });

  it('跨多次推送的半个块会被拼起来', () => {
    const chunker = new ProgressChunker();
    const half = Math.floor(blockA.length / 2);
    expect(chunker.push(blockA.slice(0, half))).toHaveLength(0);
    const blocks = chunker.push(blockA.slice(half) + blockB);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain('out_time_us=1000000');
    expect(blocks[1]).toContain('progress=end');
  });

  it('推来的块能直接交给 parseProgressBlock 使用', () => {
    const chunker = new ProgressChunker();
    const [block] = chunker.push(blockA);
    expect(block).toBeDefined();
    expect(parseProgressBlock(block ?? '').outTimeSec).toBeCloseTo(1, 3);
  });

  it('从 stderr 里兜底解析源时长（探针没给出时长时用）', () => {
    const line = '  Duration: 00:01:23.45, start: 0.000000, bitrate: 1234 kb/s';
    expect(parseDurationFromStderr(line)).toBeCloseTo(83.45, 2);
  });

  it('时长不带毫秒也能解析', () => {
    expect(parseDurationFromStderr('Duration: 00:00:07, start: 0.0, bitrate: 800 kb/s')).toBe(7);
  });

  it('超过一小时按小时算', () => {
    expect(parseDurationFromStderr('Duration: 01:02:03.50, start: 0.0')).toBeCloseTo(3723.5, 2);
  });

  it('没有时长信息时返回 null，不瞎猜', () => {
    expect(parseDurationFromStderr('Input #0, mov,mp4')).toBeNull();
    expect(parseDurationFromStderr('')).toBeNull();
    expect(parseDurationFromStderr('Duration: N/A, start: 0.0')).toBeNull();
  });

  it('多路输入时只认第一处，避免把附加输入的时长当成源时长', () => {
    const text = [
      '  Duration: 00:00:10.00, start: 0.0',
      'Input #1, lavfi, from color',
      '  Duration: 00:00:99.00, start: 0.0',
    ].join('\n');
    expect(parseDurationFromStderr(text)).toBe(10);
  });

  it('没有 progress 结束行的内容不会提前返回', () => {
    const chunker = new ProgressChunker();
    expect(chunker.push('frame=1\nfps=0.00\n')).toHaveLength(0);
  });

  it('空推送不抛错也不产出块', () => {
    const chunker = new ProgressChunker();
    expect(chunker.push('')).toHaveLength(0);
  });

  it('Windows 换行也能正确切块', () => {
    const chunker = new ProgressChunker();
    const crlf = 'frame=1\r\nout_time_us=500000\r\nprogress=continue\r\n';
    expect(chunker.push(crlf)).toHaveLength(1);
  });
});
