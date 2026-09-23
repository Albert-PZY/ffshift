/**
 * 主题的应用方式。
 *
 * 只有一件事：在 <html> 上挂对应的类名。样式侧靠这一个类切换整份令牌
 * （见 src/styles/globals.css 的 `:root` / `.dark` / `.dim`）。
 *
 * 三套主题、两个类名：亮色是 `:root` 本身，不需要类。
 * 组件层**不写 `dark:` 这类变体**——Tailwind 的 `dark:` 默认跟的是系统配色，
 * 不是应用里选的主题；需要随主题变的底色一律走语义令牌（如 `--field`）。
 *
 * 不依赖 Electron，所以能放在 src/lib；但主进程读不到 CSS，窗口底色那份
 * 等价值写在下面。
 */
import type { Theme } from './settings';

/** 主题 → <html> 上的类名；亮色是根状态，没有类 */
const THEME_CLASSES: Record<Theme, string | null> = {
  light: null,
  dim: 'dim',
  dark: 'dark',
};

const ALL_CLASSES = Object.values(THEME_CLASSES).filter((name): name is string => name !== null);

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  // 先摘干净再挂：来回切的时候不会同时留着两个类，也就不会出现"两套令牌打架"
  root.classList.remove(...ALL_CLASSES);
  const className = THEME_CLASSES[theme];
  if (className) root.classList.add(className);
}

/** 主题的显示名 */
export function themeLabel(theme: Theme): string {
  return { light: '亮色', dim: '浅黑', dark: '暗色' }[theme];
}

/**
 * 窗口底色。
 *
 * `BrowserWindow` 的 `backgroundColor` 在主进程里设，读不到 CSS 变量，
 * 只能写各套 `--background` 的等价值。**改令牌时这两处要一起改**，
 * 不然窗口先出来那一瞬间会闪一下另一个颜色。
 */
export function windowBackground(theme: Theme): string {
  return { light: '#FFFFFF', dim: '#2B2B2E', dark: '#090910' }[theme];
}

/** 渲染进程 argv 里的主题标记；主进程写，preload 读 */
export const THEME_ARG_PREFIX = '--ffshift-theme=';

/** 从 argv 解析主题；认不出就当默认亮色，不抛错 */
export function themeFromArgv(argv: readonly string[]): Theme {
  const raw = argv.find((arg) => arg.startsWith(THEME_ARG_PREFIX))?.slice(THEME_ARG_PREFIX.length);
  return raw === 'dark' || raw === 'dim' ? raw : 'light';
}
