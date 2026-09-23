import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  formatDuration,
  formatPercent,
  formatRemaining,
  formatSizeChange,
  formatSizeDelta,
  formatSpeed,
} from './format';

describe('formatBytes', () => {
  it('按二进制单位换算，保留一位小数', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KiB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MiB');
    expect(formatBytes(1024 ** 3 * 1.25)).toBe('1.3 GiB');
  });

  it('非数值或负数返回占位符，不返回 NaN', () => {
    expect(formatBytes(Number.NaN)).toBe('—');
    expect(formatBytes(-1)).toBe('—');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatDuration', () => {
  it('不足一小时只显示分秒', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(599.4)).toBe('9:59');
  });

  it('超过一小时显示时分秒', () => {
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('时长未知时返回占位符', () => {
    expect(formatDuration(Number.NaN)).toBe('—');
    expect(formatDuration(-5)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('保留一位小数', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.1234)).toBe('12.3%');
    expect(formatPercent(1)).toBe('100%');
  });

  it('越界值收敛到 0–100，避免进度条跑飞', () => {
    expect(formatPercent(1.2)).toBe('100%');
    expect(formatPercent(-0.5)).toBe('0%');
  });

  it('非数值返回占位符', () => {
    expect(formatPercent(Number.NaN)).toBe('—');
  });
});

describe('formatSpeed', () => {
  it('去掉多余的零，保留最多两位小数', () => {
    expect(formatSpeed(1.5)).toBe('1.5x');
    expect(formatSpeed(0.85)).toBe('0.85x');
    expect(formatSpeed(2)).toBe('2x');
  });

  it('非数值或非正数返回占位符', () => {
    expect(formatSpeed(0)).toBe('—');
    expect(formatSpeed(Number.NaN)).toBe('—');
  });
});

describe('formatRemaining', () => {
  it('一分钟内按秒显示', () => {
    expect(formatRemaining(5)).toBe('约 5 秒');
    expect(formatRemaining(59.2)).toBe('约 60 秒');
  });

  it('一小时内按分钟显示', () => {
    expect(formatRemaining(600)).toBe('约 10 分');
    expect(formatRemaining(90)).toBe('约 2 分');
  });

  it('超过一小时显示时分', () => {
    expect(formatRemaining(3900)).toBe('约 1 小时 5 分');
    expect(formatRemaining(7200)).toBe('约 2 小时');
  });

  it('无法估算时返回占位符', () => {
    expect(formatRemaining(Number.NaN)).toBe('—');
    expect(formatRemaining(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('formatSizeChange', () => {
  it('给出源 → 产物与增减百分比', () => {
    const hundredMiB = 100 * 1024 * 1024;
    const fiftyMiB = 50 * 1024 * 1024;
    expect(formatSizeChange(hundredMiB, fiftyMiB)).toBe('100.0 MiB → 50.0 MiB（-50%）');
    expect(formatSizeChange(fiftyMiB, hundredMiB)).toBe('50.0 MiB → 100.0 MiB（+100%）');
  });

  it('拿不到产物体积时返回 null，而不是编一个 0%', () => {
    expect(formatSizeChange(1024, null)).toBeNull();
    expect(formatSizeChange(1024, 0)).toBeNull();
    // 源文件大小没读出来时同样算不出来
    expect(formatSizeChange(0, 1024)).toBeNull();
    expect(formatSizeChange(Number.NaN, 1024)).toBeNull();
  });
});

describe('formatSizeDelta', () => {
  it('只给百分比，正数带加号', () => {
    expect(formatSizeDelta(1000, 2000)).toBe('+100%');
    expect(formatSizeDelta(1000, 500)).toBe('-50%');
    expect(formatSizeDelta(1000, 1000)).toBe('0%');
  });

  it('数据不全时返回 null', () => {
    expect(formatSizeDelta(1000, null)).toBeNull();
    expect(formatSizeDelta(0, 1000)).toBeNull();
  });
});
