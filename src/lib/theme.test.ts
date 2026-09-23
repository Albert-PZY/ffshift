import { describe, expect, it } from 'vitest';
import { otherTheme, THEME_ARG_PREFIX, themeFromArgv, themeLabel, windowBackground } from './theme';

describe('主题', () => {
  it('两态切换，来回都对得上', () => {
    expect(otherTheme('light')).toBe('dark');
    expect(otherTheme('dark')).toBe('light');
  });

  it('显示名是中文，没有英文缩写', () => {
    expect(themeLabel('light')).toBe('亮色');
    expect(themeLabel('dark')).toBe('暗色');
  });

  it('窗口底色是 --background 的等价值：亮色白、暗色 #090910', () => {
    // 主进程读不到 CSS 变量，这两个字面量必须与 globals.css 的两处 --background 一致
    expect(windowBackground('light')).toBe('#FFFFFF');
    expect(windowBackground('dark')).toBe('#090910');
  });

  it('从 argv 里认主题；没有标记或标记损坏时回默认亮色', () => {
    expect(themeFromArgv([`${THEME_ARG_PREFIX}dark`])).toBe('dark');
    expect(themeFromArgv([`${THEME_ARG_PREFIX}light`])).toBe('light');
    expect(themeFromArgv(['.', '--user-data-dir=x'])).toBe('light');
    expect(themeFromArgv([`${THEME_ARG_PREFIX}`])).toBe('light');
    expect(themeFromArgv([])).toBe('light');
  });
});
