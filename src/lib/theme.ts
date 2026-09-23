/**
 * 主题的应用方式。
 *
 * 只有一件事：在 <html> 上挂/摘 `dark` 类。样式侧靠这一个类切换整份令牌
 * （见 src/styles/globals.css 的 `:root` 与 `.dark`）。
 *
 * 不依赖 Electron，所以能放在 src/lib；但主进程读不到 CSS，窗口底色那份
 * 等价值写在 electron/main.ts 的 backgroundColor 里。
 */
import type { Theme } from './settings';

export const THEME_CLASS = 'dark';

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle(THEME_CLASS, theme === 'dark');
}

/** 另一套主题。两态切换，没有"跟随系统"——默认亮色是产品要求 */
export function otherTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}

/** 主题的显示名，给按钮与提示用 */
export function themeLabel(theme: Theme): string {
  return theme === 'dark' ? '暗色' : '亮色';
}

/**
 * 窗口底色。
 *
 * `BrowserWindow` 的 `backgroundColor` 在主进程里设，读不到 CSS 变量，
 * 只能写 `--background` 的等价值。**改令牌时这两处要一起改**，
 * 不然窗口先出来那一瞬间会闪一下另一个颜色。
 */
export function windowBackground(theme: Theme): string {
  return theme === 'dark' ? '#090910' : '#FFFFFF';
}

/** 渲染进程 argv 里的主题标记；主进程写，preload 读 */
export const THEME_ARG_PREFIX = '--ffshift-theme=';

/** 从 argv 解析主题；认不出就当默认亮色，不抛错 */
export function themeFromArgv(argv: readonly string[]): Theme {
  return argv.includes(`${THEME_ARG_PREFIX}dark`) ? 'dark' : 'light';
}
