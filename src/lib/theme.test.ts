import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './settings';
import { THEME_ARG_PREFIX, themeFromArgv, themeLabel, windowBackground } from './theme';

describe('主题', () => {
  it('三套主题都有中文显示名', () => {
    expect(themeLabel('light')).toBe('亮色');
    expect(themeLabel('dim')).toBe('浅黑');
    expect(themeLabel('dark')).toBe('暗色');
  });

  it('窗口底色是三套 --background 的等价值：亮色白、浅黑 #2B2B2E、暗色 #090910', () => {
    // 主进程读不到 CSS 变量，这三个字面量必须与 globals.css 里的 --background 一致
    expect(windowBackground('light')).toBe('#FFFFFF');
    expect(windowBackground('dim')).toBe('#2B2B2E');
    expect(windowBackground('dark')).toBe('#090910');
  });

  it('从 argv 里认主题；没有标记或标记损坏时回默认', () => {
    expect(themeFromArgv([`${THEME_ARG_PREFIX}dark`])).toBe('dark');
    expect(themeFromArgv([`${THEME_ARG_PREFIX}dim`])).toBe('dim');
    expect(themeFromArgv([`${THEME_ARG_PREFIX}light`])).toBe('light');
    expect(themeFromArgv(['.', '--user-data-dir=x'])).toBe(DEFAULT_SETTINGS.theme);
    expect(themeFromArgv([`${THEME_ARG_PREFIX}`])).toBe(DEFAULT_SETTINGS.theme);
    expect(themeFromArgv([`${THEME_ARG_PREFIX}solarized`])).toBe(DEFAULT_SETTINGS.theme);
    expect(themeFromArgv([])).toBe(DEFAULT_SETTINGS.theme);
  });

  it('argv 的兜底与设置的默认值是同一个——两处分开写，靠这条钉住', () => {
    // theme.ts 不 import settings.ts（preload 会因此变胖），所以默认值写了两遍
    expect(DEFAULT_SETTINGS.theme).toBe('dim');
    expect(themeFromArgv([])).toBe(DEFAULT_SETTINGS.theme);
  });
});
