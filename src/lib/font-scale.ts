/**
 * 界面字号。
 *
 * 这里调的其实是**根字号**（`html { font-size }`）：全站的文字、间距、控件高度、
 * 圆角、图标都是从 rem 派生的，所以改一个数会等比缩放整个界面。
 * 只放大文字是做不到的——字号大了却还用原来的行高与控件高度，文字会顶到边上。
 *
 * 四档而不是滑块：布局是按档位验过的，滑块能滑到 11px 或 22px，
 * 那两个值没人测过，出了问题也说不清是布局的锅还是缩放比例的锅。
 *
 * 上限压在 16px：三栏里有两栏是固定宽度的面板，根字号再大，
 * 最小窗口（940px）下中间那栏就放不下任务行了。要大字号请把窗口拉宽。
 */
import type { FontSize } from './settings';

export interface FontSizeOption {
  value: FontSize;
  label: string;
  px: number;
  /** 一句话说明这一档适合谁 */
  note: string;
}

export const FONT_SIZES: ReadonlyArray<FontSizeOption> = [
  { value: 'small', label: '小', px: 13, note: '一屏放得下更多' },
  { value: 'default', label: '标准', px: 14, note: '默认' },
  { value: 'large', label: '大', px: 15, note: '长时间看更轻松' },
  { value: 'larger', label: '更大', px: 16, note: '需要放大才看得清' },
];

export const DEFAULT_FONT_SIZE: FontSizeOption = FONT_SIZES[1] as FontSizeOption;

/** 取某一档的像素值；认不出的档位回默认，不抛错 */
export function fontSizePx(size: FontSize): number {
  return FONT_SIZES.find((item) => item.value === size)?.px ?? DEFAULT_FONT_SIZE.px;
}

/**
 * 应用到文档。
 *
 * 覆盖的是 `--font-size-base` 而不是直接写 `html` 的 font-size：
 * globals.css 里 `html { font-size: var(--font-size-base) }` 是唯一入口，
 * 保住它，改样式时就不会出现"两处都能定字号"的分裂。
 */
export function applyFontSize(size: FontSize): void {
  document.documentElement.style.setProperty('--font-size-base', `${fontSizePx(size)}px`);
}

/** 渲染进程 argv 里的字号标记；主进程写，preload 读 */
export const FONT_SIZE_ARG_PREFIX = '--ffshift-font-size=';

/**
 * 从 argv 解析字号。
 *
 * 传的是档位名而不是像素值——像素值一旦改档位表就对不上了，
 * 档位名在两边都是同一份白名单。
 */
export function fontSizeFromArgv(argv: readonly string[]): FontSize {
  const raw = argv.find((arg) => arg.startsWith(FONT_SIZE_ARG_PREFIX))?.slice(FONT_SIZE_ARG_PREFIX.length);
  return FONT_SIZES.some((item) => item.value === raw) ? (raw as FontSize) : 'default';
}

/**
 * 与某一档字号配套的窗口最小尺寸。
 *
 * 三栏里有两栏是固定宽度的面板，字号一大，中间那栏就放不下任务行了——
 * 940×600 在 14px 下是宽松的，16px 下会挤成一团（实测过截图）。
 * 所以下限跟着字号等比放大，而不是让布局在边角上塌掉。
 */
const BASE_WINDOW = { width: 940, height: 600, px: 14 };

export function minWindowSize(size: FontSize): { width: number; height: number } {
  const ratio = fontSizePx(size) / BASE_WINDOW.px;
  return {
    width: Math.round(BASE_WINDOW.width * ratio),
    height: Math.round(BASE_WINDOW.height * ratio),
  };
}
