/**
 * 设置读写（ADR-004：先用 JSON 文件，不引数据库）。
 *
 * 容错优先：设置文件可能被手改坏、可能是旧版本写的，
 * 任何一种情况都不能让应用起不来——解析不了就回到默认值。
 */
import { DEFAULT_ADVANCED, parseAdvanced, type AdvancedParams } from './advanced-params';
import { clampFontSize, FONT_SIZE_DEFAULT, fontSizeFromLegacyName } from './font-scale';
import { ALL_FORMATS, type OutputFormat, type Preset } from './ffmpeg-args';
import { parsePresets, type CustomPreset } from './presets';

export const SETTINGS_VERSION = 7;

/** 历史记录最多留这么多条，超出丢最旧的 */
export const HISTORY_LIMIT = 50;

export type HardwareChoice = 'none' | 'nvenc' | 'qsv' | 'amf';

/**
 * 界面主题。
 *
 * 默认亮色：桌面工具在白天办公环境下用得更多，而且亮色下界面本身不抢注意力。
 * 选过之后记住，下次启动直接是那套（见 electron/main.ts 的提前读取）。
 */
export type Theme = 'light' | 'dark';

/**
 * 界面字号：根字号的像素值，范围见 `src/lib/font-scale.ts` 的 10–24。
 *
 * 存数值而不是档位名：它本来就是一个"多少像素"的连续量，中间再放一层档位表，
 * 只会让"我设的 15px 对应哪一档"这种问题变得难解释。范围与收敛都在解析边界上做。
 */
export type FontSize = number;

/** 一条转换记录：转换完成（成功或失败）时追加 */
export interface HistoryEntry {
  id: string;
  name: string;
  inputPath: string;
  outputPath: string | null;
  inputSizeBytes: number;
  outputSizeBytes: number | null;
  format: OutputFormat;
  preset: Preset;
  /** ISO 时间字符串 */
  finishedAt: string;
  elapsedMs: number;
  status: 'done' | 'failed';
}

export interface AppSettings {
  version: number;
  preset: Preset;
  /** 输出格式；same 表示跟随输入文件的容器 */
  outputFormat: OutputFormat;
  outputDir: string | null;
  hw: HardwareChoice;
  history: HistoryEntry[];
  /** 用户保存的参数预设 */
  presets: CustomPreset[];
  /** 界面主题；默认亮色 */
  theme: Theme;
  /** 界面字号档位；默认标准 */
  fontSize: FontSize;
  /**
   * 专业参数。字段为 null 表示"不干预"，由档位决定。
   * v1.5.0 起持久化：它从对话框搬进了设置页，就该按设置的语义走（ADR-018）。
   */
  advanced: AdvancedParams;
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: SETTINGS_VERSION,
  preset: 'balanced',
  outputFormat: 'same',
  outputDir: null,
  hw: 'none',
  history: [],
  presets: [],
  theme: 'light',
  fontSize: FONT_SIZE_DEFAULT,
  advanced: { ...DEFAULT_ADVANCED },
};

const PRESETS: readonly Preset[] = ['clear', 'balanced', 'small'];
const HARDWARE: readonly HardwareChoice[] = ['none', 'nvenc', 'qsv', 'amf'];
const THEMES: readonly Theme[] = ['light', 'dark'];

/**
 * 字号解析：先认旧档位名，再认数字，越界收敛。
 *
 * 版本 6 存的是 `small | default | large | larger`，版本 7 起存像素值；
 * 认一下老名字，升级的用户不会莫名其妙回到默认字号。
 */
function parseFontSize(value: unknown): FontSize {
  const legacy = fontSizeFromLegacyName(value);
  if (legacy !== null) return legacy;
  return typeof value === 'number' ? clampFontSize(value) : FONT_SIZE_DEFAULT;
}

/** 解析单条历史记录；字段缺失或类型不对就丢弃这一条，而不是让整份设置作废 */
function parseHistoryEntry(raw: unknown): HistoryEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;

  const id = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : null;
  const name = typeof entry.name === 'string' && entry.name.length > 0 ? entry.name : null;
  const inputPath = typeof entry.inputPath === 'string' && entry.inputPath.length > 0 ? entry.inputPath : null;
  if (!id || !name || !inputPath) return null;

  const numberOrZero = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

  return {
    id,
    name,
    inputPath,
    outputPath: typeof entry.outputPath === 'string' && entry.outputPath.length > 0 ? entry.outputPath : null,
    inputSizeBytes: numberOrZero(entry.inputSizeBytes),
    outputSizeBytes:
      typeof entry.outputSizeBytes === 'number' && Number.isFinite(entry.outputSizeBytes) && entry.outputSizeBytes > 0
        ? entry.outputSizeBytes
        : null,
    format: ALL_FORMATS.includes(entry.format as OutputFormat) ? (entry.format as OutputFormat) : 'same',
    preset: PRESETS.includes(entry.preset as Preset) ? (entry.preset as Preset) : 'balanced',
    finishedAt: typeof entry.finishedAt === 'string' ? entry.finishedAt : '',
    elapsedMs: numberOrZero(entry.elapsedMs),
    status: entry.status === 'failed' ? 'failed' : 'done',
  };
}

export function parseSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_SETTINGS };

  const stored = raw as Record<string, unknown>;
  // 只对"比当前更新的版本"认输：那可能是未来写的文件，字段含义说不准。
  // 旧版本逐项解析补默认值就行——升版本是为了加字段，没必要顺手清掉用户数据。
  if (typeof stored.version === 'number' && stored.version > SETTINGS_VERSION) {
    return { ...DEFAULT_SETTINGS };
  }

  const preset = PRESETS.includes(stored.preset as Preset) ? (stored.preset as Preset) : DEFAULT_SETTINGS.preset;
  const outputFormat = ALL_FORMATS.includes(stored.outputFormat as OutputFormat)
    ? (stored.outputFormat as OutputFormat)
    : DEFAULT_SETTINGS.outputFormat;
  const hw = HARDWARE.includes(stored.hw as HardwareChoice)
    ? (stored.hw as HardwareChoice)
    : DEFAULT_SETTINGS.hw;
  const outputDir =
    typeof stored.outputDir === 'string' && stored.outputDir.length > 0 ? stored.outputDir : null;
  const theme = THEMES.includes(stored.theme as Theme) ? (stored.theme as Theme) : DEFAULT_SETTINGS.theme;
  const fontSize = parseFontSize(stored.fontSize);

  const history = Array.isArray(stored.history)
    ? stored.history
        .map(parseHistoryEntry)
        .filter((entry): entry is HistoryEntry => entry !== null)
        .slice(0, HISTORY_LIMIT)
    : [];

  return {
    version: SETTINGS_VERSION,
    preset,
    outputFormat,
    outputDir,
    hw,
    history,
    presets: parsePresets(stored.presets),
    theme,
    fontSize,
    advanced: parseAdvanced(stored.advanced),
  };
}

/** 把一条新记录插到最前面，并裁到上限 */
export function appendHistory(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...history].slice(0, HISTORY_LIMIT);
}

export function serializeSettings(settings: AppSettings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}
