/**
 * 主进程与渲染进程之间的契约。
 * 两侧共用这一份类型，改名时编译期就会报错，不用靠记忆对齐字符串。
 */
import type { ConvertOutcome, ProgressUpdate } from '../../electron/ffmpeg/convert';
import type { AdvancedParams } from './advanced-params';
import type { Suggestion } from './ai-suggest';
import type { MediaInfo } from './ffprobe';
import type { OutputFormat, Preset } from './ffmpeg-args';
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
  /** 目标格式；same 表示跟随输入文件的容器 */
  format: OutputFormat;
  hw?: 'none' | 'nvenc' | 'qsv' | 'amf';
  hasAudio: boolean;
  durationSec: number | null;
  targetSizeMiB?: number | null;
  /** 源视频的渲染信息：带透明通道时需要先合成底色 */
  source?: {
    width: number | null;
    height: number | null;
    fps: number | null;
    hasAlpha: boolean;
  };
  /** 专业参数；缺省表示全部不干预，由档位决定 */
  advanced?: AdvancedParams | null;
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
  /** 读一个 JSON 文件（导入预设用）；取消或读取失败返回 null */
  readPresetsFile: () => Promise<string | null>;
  /** 把内容写成 JSON 文件（导出预设用） */
  writePresetsFile: (content: string) => Promise<{ ok: boolean }>;
  /** 选一个文件夹（用于批量导入，或指定输出目录） */
  pickFolder: (title?: string) => Promise<string[]>;
  /** 扫描文件夹里的视频文件（按扩展名过滤，不递归） */
  scanFolder: (folder: string) => Promise<string[]>;
  /** 发一条系统通知；系统不支持时返回 ok:false */
  notify: (title: string, body: string) => Promise<{ ok: boolean }>;
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
