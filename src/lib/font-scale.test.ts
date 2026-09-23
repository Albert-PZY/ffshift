import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FONT_SIZE,
  FONT_SIZE_ARG_PREFIX,
  fontSizeFromArgv,
  fontSizePx,
  FONT_SIZES,
  minWindowSize,
} from './font-scale';

describe('界面字号', () => {
  it('四档，像素值递增且不重复', () => {
    expect(FONT_SIZES).toHaveLength(4);
    const px = FONT_SIZES.map((item) => item.px);
    expect(px).toEqual([...px].sort((a, b) => a - b));
    expect(new Set(px).size).toBe(px.length);
  });

  it('默认是标准档，也是 14px', () => {
    expect(DEFAULT_FONT_SIZE.value).toBe('default');
    expect(DEFAULT_FONT_SIZE.px).toBe(14);
  });

  it('上限压在 16px：再大三栏就放不下', () => {
    // 这条不是为了好看——最小窗口 940px 下，两栏固定面板加中间那栏，
    // 17px 开始中间就挤不下任务行了
    expect(Math.max(...FONT_SIZES.map((item) => item.px))).toBe(16);
  });

  it('取像素值；认不出的档位回默认', () => {
    expect(fontSizePx('small')).toBe(13);
    expect(fontSizePx('larger')).toBe(16);
    expect(fontSizePx('huge' as never)).toBe(14);
  });

  it('从 argv 认档位名；没有标记或值非法时回默认', () => {
    expect(fontSizeFromArgv([`${FONT_SIZE_ARG_PREFIX}larger`])).toBe('larger');
    expect(fontSizeFromArgv(['.', `--user-data-dir=x`])).toBe('default');
    expect(fontSizeFromArgv([`${FONT_SIZE_ARG_PREFIX}`])).toBe('default');
    // 像素值不认：两边的唯一事实是档位名
    expect(fontSizeFromArgv([`${FONT_SIZE_ARG_PREFIX}16`])).toBe('default');
  });
});

describe('窗口最小尺寸跟着字号走', () => {
  it('标准档就是原来的 940×600', () => {
    expect(minWindowSize('default')).toEqual({ width: 940, height: 600 });
  });

  it('每档按同一比例算，字号大的要更大的地方', () => {
    expect(minWindowSize('small')).toEqual({ width: 873, height: 557 });
    expect(minWindowSize('large')).toEqual({ width: 1007, height: 643 });
    expect(minWindowSize('larger')).toEqual({ width: 1074, height: 686 });
  });

  it('单调递增：档位越大下限越大，不会出现反过来的情况', () => {
    const widths = FONT_SIZES.map((item) => minWindowSize(item.value).width);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
  });
});
