/**
 * 主进程与渲染进程之间的契约。
 * 两侧共用这一份类型，改名时编译期就会报错，不用靠记忆对齐字符串。
 */
import type { ConvertOutcome, ProgressUpdate } from '../../electron/ffmpeg/convert';
import type { AdvancedParams } from './advanced-params';
import type { MediaInfo } from './ffprobe';
import type { OutputFormat, Preset } from './ffmpeg-args';
import type { AppSettings, CloseAction, FontSize, Theme } from './settings';

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

/**
 * 无边框窗口的自绘控制。
 *
 * 窗口没有系统边框，最小化 / 最大化 / 关闭必须由界面提供；
 * `isMaximized` 用来在最大化与还原之间换图标。
 */
export interface FrameControls {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
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
  loadSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<AppSettings>;
  revealOutput: (filePath: string) => Promise<{ ok: boolean }>;
  /** 无边框窗口的自绘控制按钮 */
  frame: FrameControls;
  /**
   * 启动时的主题。
   *
   * 主进程在建窗口之前读设置，把它塞进渲染进程的 argv——渲染进程要能**同步**拿到，
   * 否则第一帧永远是亮色，暗色用户每次启动都会看见一记白闪。
   */
  initialTheme: Theme;
  /**
   * 启动时的界面字号档位。与主题同理：根字号决定整个界面的尺寸，
   * 晚一帧就会看见界面先小后大地跳一下。
   */
  initialFontSize: FontSize;
  onProgress: (listener: (event: ProgressEvent) => void) => () => void;
  onFinished: (listener: (event: FinishedEvent) => void) => () => void;
  /**
   * 用户点了关闭按钮，主进程问渲染进程要怎么办。
   *
   * 关闭按钮是自绘的，但真正决定"关还是缩到托盘"的是主进程——
   * 那里才知道窗口状态与托盘在不在。所以流程是：
   * 主进程拦下 close → 问渲染进程 → 渲染进程弹确认框 → 回话。
   */
  onCloseRequest: (listener: () => void) => () => void;
  /** 回答上面那次询问；remember 为真时把选择写进设置，下次不再问 */
  respondCloseRequest: (choice: CloseAction, remember: boolean) => Promise<{ ok: boolean }>;
  /** 拖放的 File 对象在渲染进程拿不到磁盘路径，必须走它 */
  getPathForFile: (file: File) => string;
}

declare global {
  interface Window {
    ffshift?: FfshiftApi;
  }
}
