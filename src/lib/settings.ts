/**
 * 设置读写（ADR-004：先用 JSON 文件，不引数据库）。
 *
 * 容错优先：设置文件可能被手改坏、可能是旧版本写的，
 * 任何一种情况都不能让应用起不来——解析不了就回到默认值。
 */
import type { OutputFormat, Preset } from './ffmpeg-args';

export const SETTINGS_VERSION = 1;

export type HardwareChoice = 'none' | 'nvenc' | 'qsv' | 'amf';

export interface AppSettings {
  version: number;
  preset: Preset;
  /** 输出格式；same 表示跟随输入文件的容器 */
  outputFormat: OutputFormat;
  outputDir: string | null;
  hw: HardwareChoice;
}

export const DEFAULT_SETTINGS: AppSettings = {
  version: SETTINGS_VERSION,
  preset: 'balanced',
  outputFormat: 'same',
  outputDir: null,
  hw: 'none',
};

const PRESETS: readonly Preset[] = ['clear', 'balanced', 'small'];
const FORMATS: readonly OutputFormat[] = ['same', 'mp4', 'mkv', 'mov', 'webm'];
const HARDWARE: readonly HardwareChoice[] = ['none', 'nvenc', 'qsv', 'amf'];

export function parseSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_SETTINGS };

  const stored = raw as Record<string, unknown>;
  // 版本号对不上才整体回到默认；缺版本号当成手写的 v1 设置，逐项补默认值
  if (stored.version !== undefined && stored.version !== SETTINGS_VERSION) {
    return { ...DEFAULT_SETTINGS };
  }

  const preset = PRESETS.includes(stored.preset as Preset) ? (stored.preset as Preset) : DEFAULT_SETTINGS.preset;
  const outputFormat = FORMATS.includes(stored.outputFormat as OutputFormat)
    ? (stored.outputFormat as OutputFormat)
    : DEFAULT_SETTINGS.outputFormat;
  const hw = HARDWARE.includes(stored.hw as HardwareChoice)
    ? (stored.hw as HardwareChoice)
    : DEFAULT_SETTINGS.hw;
  const outputDir =
    typeof stored.outputDir === 'string' && stored.outputDir.length > 0 ? stored.outputDir : null;

  return { version: SETTINGS_VERSION, preset, outputFormat, outputDir, hw };
}

export function serializeSettings(settings: AppSettings): string {
  return `${JSON.stringify(settings, null, 2)}\n`;
}
