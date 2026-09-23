/**
 * 界面字号。
 *
 * 这里调的是**根字号**（`html { font-size }`）：全站的文字、间距、控件高度、
 * 圆角、图标都是从 rem 派生的，所以改一个数会等比缩放整个界面。
 * 只放大文字是做不到的——字号大了却还用原来的行高与控件高度，文字会顶到边上。
 *
 * 范围 10–24px、逐像素可选，默认 14。注意它是**基准**而不是正文大小：
 * 正文是 `text-sm`（0.875rem），所以基准 14px 时正文是 12.25px。
 * 界面上用 `derivedFontSizes` 把这几档一起报出来，免得用户对着"14px"猜。
 *
 * 面板宽度、标题栏高度这些**外壳尺寸不跟着字号变**（见 docs/design-system.md）：
 * 它们要是跟着缩放，24px 下三栏骨架得占掉 1600px，普通笔记本装不下。
 */
export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 24;
export const FONT_SIZE_DEFAULT = 14;

/** 下拉里的可选项：范围内的每一个整数 */
export const FONT_SIZE_OPTIONS: readonly number[] = Array.from(
  { length: FONT_SIZE_MAX - FONT_SIZE_MIN + 1 },
  (_, index) => FONT_SIZE_MIN + index,
);

/** 收敛到范围内的整数；不是有限数就回默认 */
export function clampFontSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return FONT_SIZE_DEFAULT;
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)));
}

/**
 * 旧的四档档位名 → 像素值。
 *
 * 设置文件在版本 6 里存的是 `small | default | large | larger`，版本 7 改成像素值。
 * 认一下老名字，用户升级时不会莫名其妙回到默认。
 */
const LEGACY_NAMES: Record<string, number> = { small: 13, default: 14, large: 15, larger: 16 };

export function fontSizeFromLegacyName(name: unknown): number | null {
  return typeof name === 'string' ? (LEGACY_NAMES[name] ?? null) : null;
}

/** 与基准配套的几个可见字号，给界面用来说明"这个基准意味着多大" */
const VISIBLE_SCALE = { body: 0.875, meta: 0.75, label: 0.714 } as const;

export function derivedFontSizes(base: number): { body: number; meta: number; label: number } {
  const px = clampFontSize(base);
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    body: round(px * VISIBLE_SCALE.body),
    meta: round(px * VISIBLE_SCALE.meta),
    label: round(px * VISIBLE_SCALE.label),
  };
}

/**
 * 应用到文档。
 *
 * 覆盖的是 `--font-size-base` 而不是直接写 `html` 的 font-size：
 * globals.css 里 `html { font-size: var(--font-size-base) }` 是唯一入口，
 * 保住它，改样式时就不会出现"两处都能定字号"的分裂。
 */
export function applyFontSize(size: number): void {
  document.documentElement.style.setProperty('--font-size-base', `${clampFontSize(size)}px`);
}

/** 渲染进程 argv 里的字号标记；主进程写，preload 读 */
export const FONT_SIZE_ARG_PREFIX = '--ffshift-font-size=';

/** 从 argv 解析字号；认不出或越界就收敛 */
export function fontSizeFromArgv(argv: readonly string[]): number {
  const raw = argv.find((arg) => arg.startsWith(FONT_SIZE_ARG_PREFIX))?.slice(FONT_SIZE_ARG_PREFIX.length);
  const parsed = Number(raw);
  return raw === undefined || raw === '' || !Number.isFinite(parsed) ? FONT_SIZE_DEFAULT : clampFontSize(parsed);
}
