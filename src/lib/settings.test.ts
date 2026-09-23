import { describe, expect, it } from 'vitest';
import { DEFAULT_ADVANCED } from './advanced-params';
import {
  DEFAULT_SETTINGS,
  HISTORY_LIMIT,
  appendHistory,
  parseSettings,
  serializeSettings,
  type HistoryEntry,
} from './settings';

describe('parseSettings', () => {
  it('完整设置原样返回', () => {
    const stored = {
      version: 7,
      preset: 'small',
      outputFormat: 'mp4',
      outputDir: 'D:\\输出',
      hw: 'nvenc',
      history: [],
      presets: [],
      theme: 'dark',
      fontSize: 16,
      advanced: { ...DEFAULT_ADVANCED, crf: 18 },
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

  it('主题默认浅黑：缺字段、写坏了、写了别的词都回到浅黑', () => {
    expect(DEFAULT_SETTINGS.theme).toBe('dim');
    expect(parseSettings({}).theme).toBe('dim');
    expect(parseSettings({ theme: 'solarized' }).theme).toBe('dim');
    expect(parseSettings({ theme: 1 }).theme).toBe('dim');
    // 选过的要留下来，不能被默认值吃掉
    expect(parseSettings({ theme: 'dark' }).theme).toBe('dark');
    expect(parseSettings({ theme: 'light' }).theme).toBe('light');
  });

  it('字号默认 15px；越界收敛、认不出回默认、旧档位名照旧认', () => {
    expect(DEFAULT_SETTINGS.fontSize).toBe(15);
    expect(parseSettings({}).fontSize).toBe(15);
    expect(parseSettings({ fontSize: 18 }).fontSize).toBe(18);
    // 越界往边界收，而不是丢掉用户的选择
    expect(parseSettings({ fontSize: 40 }).fontSize).toBe(24);
    expect(parseSettings({ fontSize: 2 }).fontSize).toBe(10);
    // 认不出的回默认
    expect(parseSettings({ fontSize: '16px' }).fontSize).toBe(15);
    expect(parseSettings({ fontSize: 'huge' }).fontSize).toBe(15);
    // 版本 6 存的是档位名，升级时不能丢
    expect(parseSettings({ fontSize: 16 }).fontSize).toBe(16);
    expect(parseSettings({ fontSize: 'small' }).fontSize).toBe(13);
  });

  it('旧版本（没有 theme 字段）读出来是默认主题，其余字段照旧保留', () => {
    const old = parseSettings({ version: 3, preset: 'small', outputDir: 'D:\\输出' });
    expect(old.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(old.preset).toBe('small');
    expect(old.outputDir).toBe('D:\\输出');
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

  // 回归：白名单曾漏掉后加的音频与动图格式，用户选了存不下去，重启悄悄回到默认
  it('后加的音频与动图格式同样记得住', () => {
    for (const format of ['gif', 'mp3', 'm4a', 'opus', 'flac', 'wav'] as const) {
      expect(parseSettings({ outputFormat: format }).outputFormat).toBe(format);
    }
  });

  it('比当前更高的版本号不猜，直接回到默认', () => {
    expect(parseSettings({ version: 99, preset: 'clear' })).toEqual(DEFAULT_SETTINGS);
  });

  it('旧版本能升级：偏好留着，新字段给默认值', () => {
    const parsed = parseSettings({ version: 1, preset: 'clear', outputFormat: 'mp3' });
    expect(parsed.version).toBe(7);
    expect(parsed.preset).toBe('clear');
    expect(parsed.outputFormat).toBe('mp3');
    expect(parsed.history).toEqual([]);
    expect(parsed.presets).toEqual([]);
    expect(parsed.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(parsed.advanced).toEqual(DEFAULT_ADVANCED);
  });
});

describe('历史记录', () => {
  const entry: HistoryEntry = {
    id: 'h1',
    name: '片段.mp4',
    inputPath: 'D:\\素材\\片段.mkv',
    outputPath: 'D:\\素材\\片段.ffshift.mp4',
    inputSizeBytes: 4_718_592,
    outputSizeBytes: 2_311_319,
    format: 'mp4',
    preset: 'balanced',
    finishedAt: '2026-09-23T15:00:00.000Z',
    elapsedMs: 793,
    status: 'done',
  };

  it('合法记录原样保留', () => {
    expect(parseSettings({ history: [entry] }).history).toEqual([entry]);
  });

  it('缺关键字段的记录被丢掉，同批的其它记录不受影响', () => {
    const broken = { ...entry, id: '', inputPath: '' };
    expect(parseSettings({ history: [broken, entry] }).history).toEqual([entry]);
  });

  it('history 不是数组时给空数组，不让整份设置作废', () => {
    expect(parseSettings({ history: '坏了' }).history).toEqual([]);
    expect(parseSettings({ history: null }).history).toEqual([]);
    expect(parseSettings({}).history).toEqual([]);
  });

  it('超过上限时只留最近的', () => {
    const many = Array.from({ length: 80 }, (_, index) => ({ ...entry, id: `h${index}` }));
    const parsed = parseSettings({ history: many }).history;
    expect(parsed).toHaveLength(HISTORY_LIMIT);
    expect(parsed[0]?.id).toBe('h0');
  });

  it('新记录插到最前面，并裁到上限', () => {
    const history = Array.from({ length: HISTORY_LIMIT }, (_, index) => ({ ...entry, id: `h${index}` }));
    const next = appendHistory(history, { ...entry, id: 'new' });
    expect(next[0]?.id).toBe('new');
    expect(next).toHaveLength(HISTORY_LIMIT);
  });
});

describe('serializeSettings', () => {
  it('写出的 JSON 能被读回来，字段不丢', () => {
    const settings = {
      version: 7,
      preset: 'small' as const,
      outputFormat: 'webm' as const,
      outputDir: 'D:\\输出',
      hw: 'qsv' as const,
      history: [],
      presets: [],
      theme: 'dark' as const,
      fontSize: 15,
      advanced: { ...DEFAULT_ADVANCED, gop: 60, audioMode: 'copy' as const },
    };
    expect(parseSettings(JSON.parse(serializeSettings(settings)))).toEqual(settings);
  });

  it('输出带换行，方便人直接看和手改', () => {
    expect(serializeSettings(DEFAULT_SETTINGS)).toContain('\n');
  });
});
