import { describe, expect, it } from 'vitest';
import {
  clampFontSize,
  derivedFontSizes,
  FONT_SIZE_ARG_PREFIX,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_OPTIONS,
  fontSizeFromArgv,
  fontSizeFromLegacyName,
} from './font-scale';

describe('界面字号的取值范围', () => {
  it('10–24px 逐像素可选，共 15 项，且严格递增', () => {
    expect(FONT_SIZE_OPTIONS).toHaveLength(15);
    expect(FONT_SIZE_OPTIONS[0]).toBe(10);
    expect(FONT_SIZE_OPTIONS.at(-1)).toBe(24);
    expect(FONT_SIZE_OPTIONS).toEqual([...FONT_SIZE_OPTIONS].sort((a, b) => a - b));
  });

  it('默认 14px，在范围内', () => {
    expect(FONT_SIZE_DEFAULT).toBe(14);
    expect(FONT_SIZE_OPTIONS).toContain(FONT_SIZE_DEFAULT);
  });
});

describe('clampFontSize', () => {
  it('范围内的整数原样返回', () => {
    expect(clampFontSize(10)).toBe(10);
    expect(clampFontSize(14)).toBe(14);
    expect(clampFontSize(24)).toBe(24);
  });

  it('越界收敛到边界，小数四舍五入', () => {
    expect(clampFontSize(9)).toBe(10);
    expect(clampFontSize(-3)).toBe(10);
    expect(clampFontSize(99)).toBe(24);
    expect(clampFontSize(15.4)).toBe(15);
    expect(clampFontSize(15.6)).toBe(16);
  });

  it('不是有限数就回默认，不让 NaN 漏到样式里', () => {
    expect(clampFontSize(Number.NaN)).toBe(FONT_SIZE_DEFAULT);
    expect(clampFontSize(Number.POSITIVE_INFINITY)).toBe(FONT_SIZE_DEFAULT);
    expect(clampFontSize('16')).toBe(FONT_SIZE_DEFAULT);
    expect(clampFontSize(null)).toBe(FONT_SIZE_DEFAULT);
    expect(clampFontSize(undefined)).toBe(FONT_SIZE_DEFAULT);
  });
});

describe('旧档位名', () => {
  it('四档老名字能认出来，升级时不丢用户的选择', () => {
    expect(fontSizeFromLegacyName('small')).toBe(13);
    expect(fontSizeFromLegacyName('default')).toBe(14);
    expect(fontSizeFromLegacyName('large')).toBe(15);
    expect(fontSizeFromLegacyName('larger')).toBe(16);
  });

  it('认不出的返回 null，由调用方决定回什么', () => {
    expect(fontSizeFromLegacyName('huge')).toBeNull();
    expect(fontSizeFromLegacyName(16)).toBeNull();
    expect(fontSizeFromLegacyName(null)).toBeNull();
  });
});

describe('derivedFontSizes', () => {
  it('基准 14px 时正文 12.25、元信息 10.5、小节标题 10——就是当前的观感', () => {
    expect(derivedFontSizes(14)).toEqual({ body: 12.3, meta: 10.5, label: 10 });
  });

  it('按同一比例缩放，且都保留一位小数', () => {
    expect(derivedFontSizes(16)).toEqual({ body: 14, meta: 12, label: 11.4 });
    expect(derivedFontSizes(24)).toEqual({ body: 21, meta: 18, label: 17.1 });
  });

  it('越界值先收敛再换算，不会算出离谱的字号', () => {
    expect(derivedFontSizes(100)).toEqual(derivedFontSizes(24));
    expect(derivedFontSizes(0)).toEqual(derivedFontSizes(10));
  });
});

describe('fontSizeFromArgv', () => {
  it('认数字；没有标记或认不出时回默认', () => {
    expect(fontSizeFromArgv([`${FONT_SIZE_ARG_PREFIX}18`])).toBe(18);
    expect(fontSizeFromArgv(['.', '--user-data-dir=x'])).toBe(FONT_SIZE_DEFAULT);
    expect(fontSizeFromArgv([`${FONT_SIZE_ARG_PREFIX}`])).toBe(FONT_SIZE_DEFAULT);
    expect(fontSizeFromArgv([`${FONT_SIZE_ARG_PREFIX}abc`])).toBe(FONT_SIZE_DEFAULT);
  });

  it('越界的值收敛到范围内，不把 40px 应用上去', () => {
    expect(fontSizeFromArgv([`${FONT_SIZE_ARG_PREFIX}40`])).toBe(24);
    expect(fontSizeFromArgv([`${FONT_SIZE_ARG_PREFIX}4`])).toBe(10);
  });
});
