import { describe, expect, it } from 'vitest';
import { isActive, isFinished, statusLabel, statusTone } from './task-status';

describe('task-status', () => {
  it('八个状态都有中文标签与色档，没有漏网的', () => {
    const all = ['reading', 'ready', 'queued', 'running', 'done', 'failed', 'cancelled', 'unsupported'] as const;
    for (const status of all) {
      expect(statusLabel(status).length).toBeGreaterThan(0);
      expect(statusTone(status).length).toBeGreaterThan(0);
    }
  });

  it('文案与 docs/writing-style.md 的五个状态词对得上', () => {
    // 契约：全局只用这五个词。读取中/待转换/不支持是队列额外需要的三个
    expect(['排队中', '转换中', '已完成', '失败', '已取消']).toEqual([
      statusLabel('queued'),
      statusLabel('running'),
      statusLabel('done'),
      statusLabel('failed'),
      statusLabel('cancelled'),
    ]);
  });

  it('颜色只表达状态本身：完成是成功色，取消是警告色，不是失败', () => {
    expect(statusTone('done')).toBe('success');
    expect(statusTone('cancelled')).toBe('warning');
    expect(statusTone('failed')).toBe('danger');
    expect(statusTone('unsupported')).toBe('danger');
  });

  it('运行中与排队中都算活跃，底栏据此决定小圆点亮不亮', () => {
    expect(isActive('running')).toBe(true);
    expect(isActive('queued')).toBe(true);
    expect(isActive('ready')).toBe(false);
    expect(isActive('reading')).toBe(false);
  });

  it('只有结束状态可以被移除；读取中与待转换的不给移除按钮', () => {
    expect(isFinished('done')).toBe(true);
    expect(isFinished('failed')).toBe(true);
    expect(isFinished('cancelled')).toBe(true);
    expect(isFinished('unsupported')).toBe(true);
    expect(isFinished('ready')).toBe(false);
    expect(isFinished('reading')).toBe(false);
  });
});
