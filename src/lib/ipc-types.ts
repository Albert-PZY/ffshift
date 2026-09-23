/**
 * 主进程与渲染进程之间的契约。
 * 两侧共用这一份类型，改名时编译期就会报错，不用靠记忆对齐字符串。
 */
import type { ConvertOutcome, ProgressUpdate } from '../../electron/ffmpeg/convert';
import type { Suggestion } from './ai-suggest';
import type { MediaInfo } from './ffprobe';
import type { Preset } from './ffmpeg-args';
import type { AppSettings } from './settings';

export interface SuggestResponse {
  suggestion: Suggestion;
  /** 一句话说明这次建议的来源（模型 / 本地规则） */
  note: string;
}

export interface ProbeResponse {
  ok: boolean;
  info?: MediaInfo;
  /** 不可转换或探测失败时的人话原因 */
  reason?: string;
  convertibility?: { ok: boolean; reason: string | null };
}

export interface ThumbnailResponse {
  ok: boolean;
  dataUrl?: string;
  reason?: string;
}

export interface ConvertRequest {
  taskId: string;
  input: string;
  output: string;
  preset: Preset;
  hw?: 'none' | 'nvenc' | 'qsv' | 'amf';
  hasAudio: boolean;
  durationSec: number | null;
  targetSizeMiB?: number | null;
}

export type ConvertResponse = { ok: true } | { ok: false; reason: string };

export interface ProgressEvent {
  taskId: string;
  update: ProgressUpdate;
}

export interface FinishedEvent {
  taskId: string;
  outcome: ConvertOutcome;
}

export interface HardwareReport {
  available: Array<'nvenc' | 'qsv' | 'amf'>;
  checkedAt: string;
}

export interface FfshiftApi {
  pickFiles: () => Promise<string[]>;
  probe: (path: string) => Promise<ProbeResponse>;
  thumbnail: (path: string, durationSec: number | null) => Promise<ThumbnailResponse>;
  convert: (request: ConvertRequest) => Promise<ConvertResponse>;
  cancel: (taskId: string) => Promise<{ ok: boolean }>;
  detectHardware: () => Promise<HardwareReport>;
  ffmpegVersion: () => Promise<string | null>;
  suggest: (description: string) => Promise<SuggestResponse>;
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<AppSettings>;
  revealOutput: (filePath: string) => Promise<{ ok: boolean }>;
  onProgress: (listener: (event: ProgressEvent) => void) => () => void;
  onFinished: (listener: (event: FinishedEvent) => void) => () => void;
  /** 拖放的 File 对象在渲染进程拿不到磁盘路径，必须走它 */
  getPathForFile: (file: File) => string;
}

declare global {
  interface Window {
    ffshift?: FfshiftApi;
  }
}
