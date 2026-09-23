import { describe, expect, it } from 'vitest';
import { DEFAULT_ADVANCED } from './advanced-params';
import {
  BUILTIN_PRESETS,
  MAX_PRESETS,
  createPreset,
  exportPresets,
  importPresets,
  parsePresets,
  presetToParams,
  type CustomPreset,
} from './presets';

const sample: CustomPreset = {
  id: 'user-1',
  name: '我的预设',
  params: { crf: 20, encoderPreset: 'slow' },
  createdAt: '2026-09-23T10:00:00.000Z',
};

describe('内置预设', () => {
  it('每一项都能补成完整参数，没有 undefined 漏出来', () => {
    for (const preset of BUILTIN_PRESETS) {
      const params = presetToParams(preset);
      expect(Object.values(params).every((value) => value !== undefined)).toBe(true);
      expect(Object.keys(params).sort()).toEqual(Object.keys(DEFAULT_ADVANCED).sort());
    }
  });

  it('id 不重复', () => {
    const ids = BUILTIN_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('parsePresets', () => {
  it('合法条目原样保留', () => {
    expect(parsePresets([sample])).toEqual([sample]);
  });

  it('缺 id 或名字的条目被丢掉，其它不受影响', () => {
    expect(parsePresets([{ name: '没 id', params: {} }, sample])).toEqual([sample]);
    expect(parsePresets([{ id: 'x', name: '   ', params: {} }, sample])).toEqual([sample]);
  });

  it('不是数组时给空数组', () => {
    expect(parsePresets('坏了')).toEqual([]);
    expect(parsePresets(null)).toEqual([]);
    expect(parsePresets({ presets: [sample] })).toEqual([]);
  });

  it('名字过长会被截断', () => {
    const long = { ...sample, name: '名'.repeat(40) };
    expect(parsePresets([long])[0]?.name.length).toBeLessThanOrEqual(24);
  });

  it('超过上限只取前面几条', () => {
    const many = Array.from({ length: MAX_PRESETS + 10 }, (_, index) => ({ ...sample, id: `u${index}` }));
    expect(parsePresets(many)).toHaveLength(MAX_PRESETS);
  });
});

describe('exportPresets 与 importPresets', () => {
  it('导出再导入能还原', () => {
    const text = exportPresets([sample]);
    expect(importPresets(text, []).presets).toEqual([sample]);
  });

  it('同名的不重复导入', () => {
    const text = exportPresets([sample]);
    const result = importPresets(text, [sample]);
    expect(result.added).toBe(0);
    expect(result.presets).toHaveLength(1);
  });

  it('坏 JSON 不会炸，原样返回已有预设', () => {
    const result = importPresets('{ 不是 JSON', [sample]);
    expect(result.added).toBe(0);
    expect(result.presets).toEqual([sample]);
  });

  it('也认裸数组格式', () => {
    const result = importPresets(JSON.stringify([sample]), []);
    expect(result.added).toBe(1);
  });

  it('已有预设接近上限时不再无限接收', () => {
    const existing = Array.from({ length: MAX_PRESETS }, (_, index) => ({
      ...sample,
      id: `u${index}`,
      name: `已有 ${index}`,
    }));
    const incoming = Array.from({ length: 5 }, (_, index) => ({
      ...sample,
      id: `n${index}`,
      name: `新的 ${index}`,
    }));
    const result = importPresets(exportPresets(incoming), existing);
    expect(result.presets).toHaveLength(MAX_PRESETS);
    expect(result.added).toBe(0);
  });
});

describe('createPreset', () => {
  it('只存改动过的字段，null 不写进去', () => {
    const preset = createPreset('精简', { ...DEFAULT_ADVANCED, crf: 20 }, []);
    expect(preset.params).toEqual({ crf: 20 });
  });

  it('重名自动加序号', () => {
    const first = createPreset('常用', { ...DEFAULT_ADVANCED, crf: 20 }, []);
    const second = createPreset('常用', { ...DEFAULT_ADVANCED, crf: 22 }, [first]);
    expect(second.name).toBe('常用 2');
  });

  it('名字为空时给个兜底名', () => {
    expect(createPreset('   ', DEFAULT_ADVANCED, []).name).toBe('未命名预设');
  });
});
