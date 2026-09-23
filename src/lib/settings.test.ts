import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings, serializeSettings } from './settings';

describe('parseSettings', () => {
  it('完整设置原样返回', () => {
    const stored = {
      version: 1,
      preset: 'small',
      outputFormat: 'mp4',
      outputDir: 'D:\\输出',
      hw: 'nvenc',
    };
    expect(parseSettings(stored)).toEqual(stored);
  });

  it('空值、非法值一律回到默认，不让坏配置卡住启动', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('不是对象')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  it('缺字段时逐项补默认值', () => {
    expect(parseSettings({ preset: 'clear' })).toEqual({ ...DEFAULT_SETTINGS, preset: 'clear' });
    expect(parseSettings({}).preset).toBe('balanced');
  });

  it('档位或硬件加速值不在白名单里时回到默认', () => {
    expect(parseSettings({ preset: 'turbo' }).preset).toBe('balanced');
    expect(parseSettings({ hw: 'cuda' }).hw).toBe('none');
  });

  it('输出目录不是字符串时置空', () => {
    expect(parseSettings({ outputDir: 42 }).outputDir).toBeNull();
    expect(parseSettings({ outputDir: '' }).outputDir).toBeNull();
  });

  it('输出格式也记得住，非法值回到 same', () => {
    expect(parseSettings({ outputFormat: 'webm' }).outputFormat).toBe('webm');
    expect(parseSettings({ outputFormat: 'mp4' }).outputFormat).toBe('mp4');
    expect(parseSettings({ outputFormat: 'avi' }).outputFormat).toBe('same');
    expect(parseSettings({}).outputFormat).toBe('same');
  });

  it('版本号不同时不猜，直接回到默认（v1 是第一个版本）', () => {
    expect(parseSettings({ version: 99, preset: 'clear' })).toEqual(DEFAULT_SETTINGS);
  });
});

describe('serializeSettings', () => {
  it('写出的 JSON 能被读回来，字段不丢', () => {
    const settings = {
      version: 1,
      preset: 'small' as const,
      outputFormat: 'webm' as const,
      outputDir: 'D:\\输出',
      hw: 'qsv' as const,
    };
    expect(parseSettings(JSON.parse(serializeSettings(settings)))).toEqual(settings);
  });

  it('输出带换行，方便人直接看和手改', () => {
    expect(serializeSettings(DEFAULT_SETTINGS)).toContain('\n');
  });
});
