/**
 * 界面状态与队列调度。
 *
 * 三条约定：
 *   - 队列一次只跑一个任务，跑完一个自动取下一个（硬件编码器够快时也不会打满 CPU）；
 *   - 界面不直接碰 ffmpeg，全部走 window.ffshift（preload 白名单）；
 *   - 档位、输出格式、输出目录改动后立刻落盘，下次启动还在。
 */
import { create } from 'zustand';
import type { ConvertOutcome, ProgressUpdate } from '../electron/ffmpeg/convert';
import { outputPathFor, type OutputFormat, type Preset } from './lib/ffmpeg-args';
import type { MediaInfo } from './lib/ffprobe';

/** 任务状态；界面上的五个状态词与这里一一对应 */
export type TaskStatus = 'reading' | 'ready' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'unsupported';

export interface TaskItem {
  id: string;
  path: string;
  name: string;
  sizeBytes: number;
  info: MediaInfo | null;
  thumbnail: string | null;
  status: TaskStatus;
  progress: ProgressUpdate | null;
  outcome: ConvertOutcome | null;
  output: string | null;
  reason: string | null;
  /** 连续失败次数；到 2 就停止自动入队，逼用户先看看文件本身有没有问题 */
  failCount: number;
  /** ffmpeg 的原始输出末尾若干行，供"查看原始日志"展开 */
  errorRaw: string | null;
}

const api = () => window.ffshift;

/** 失败任务自动重试的上限；到顶后只能手动点重试 */
const MAX_AUTO_RETRY = 2;

let sequence = 0;
const nextId = () => `task-${(sequence += 1)}`;

interface State {
  tasks: TaskItem[];
  preset: Preset;
  /** AI 建议里的目标体积（MiB）；null 表示不限体积 */
  targetSizeMiB: number | null;
  /** 输出格式；same 表示跟随输入 */
  outputFormat: OutputFormat;
  outputDir: string | null;
  hardware: string[];
  ffmpegVersion: string | null;
  addFiles: (paths: string[]) => Promise<void>;
  startAll: () => Promise<void>;
  /** 只推进队列：跑完一个接着下一个，不重置其它任务 */
  pumpNext: () => Promise<void>;
  cancelTask: (id: string) => Promise<void>;
  /** 手动重试：清掉失败计数与原始日志，重新排队 */
  retryTask: (id: string) => void;
  removeTask: (id: string) => void;
  clearFinished: () => void;
  setPreset: (preset: Preset) => void;
  setOutputFormat: (format: OutputFormat) => void;
  /** 直接指定目标体积（MiB）；null 表示不限体积。不持久化：它是针对当前批次的临时设置 */
  setTargetSize: (targetSizeMiB: number | null) => void;
  /** 采纳 AI 建议：档位与目标体积一起生效（否则体积建议等于空话） */
  applySuggestion: (preset: Preset, targetSizeMiB: number | null) => void;
  pickOutputDir: () => Promise<void>;
  clearOutputDir: () => void;
  /** 选一个文件夹，把里面的视频一次性加进来 */
  addFolder: () => Promise<void>;
  detectHardware: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

export const useStore = create<State>((set, get) => {
  /** 队列串行：只有没有 running 时才启动下一个 queued。 */
  const pump = async (): Promise<void> => {
    const { tasks, preset, outputDir } = get();
    if (tasks.some((t) => t.status === 'running')) return;

    const next = tasks.find((t) => t.status === 'queued');
    if (!next || !next.info) return;

    const output = next.output ?? outputPathFor(next.path, get().outputFormat, outputDir);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === next.id ? { ...t, status: 'running', output } : t)),
    }));

    // 探测到硬件编码器就自动用：用户不需要知道 nvenc 和 qsv 的区别
    const hw: 'none' | 'nvenc' | 'qsv' | 'amf' = get().hardware.includes('nvenc')
      ? 'nvenc'
      : get().hardware.includes('qsv')
        ? 'qsv'
        : get().hardware.includes('amf')
          ? 'amf'
          : 'none';

    const response = await api()?.convert({
      taskId: next.id,
      input: next.path,
      output,
      preset,
      format: get().outputFormat,
      hw,
      hasAudio: next.info.hasAudio,
      durationSec: next.info.durationSec,
      targetSizeMiB: get().targetSizeMiB,
      source: {
        width: next.info.width,
        height: next.info.height,
        fps: next.info.fps,
        hasAlpha: next.info.hasAlpha,
      },
    });

    if (response && !response.ok) {
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === next.id ? { ...t, status: 'failed', reason: response.reason } : t,
        ),
      }));
      void pump();
    }
    void outputDir;
  };

  return {
    tasks: [],
    preset: 'balanced',
    outputFormat: 'same',
    outputDir: null,
    hardware: [],
    ffmpegVersion: null,
    targetSizeMiB: null,

    async addFiles(paths) {
      const ffshift = api();
      if (!ffshift || paths.length === 0) return;

      const existing = new Set(get().tasks.map((t) => t.path));
      const fresh = paths.filter((p) => !existing.has(p));
      if (fresh.length === 0) return;

      const items: TaskItem[] = fresh.map((path) => ({
        id: nextId(),
        path,
        name: path.split(/[\\/]/).pop() ?? path,
        sizeBytes: 0,
        info: null,
        thumbnail: null,
        status: 'reading',
        progress: null,
        outcome: null,
        output: null,
        failCount: 0,
        errorRaw: null,
        reason: null,
      }));
      set((state) => ({ tasks: [...state.tasks, ...items] }));

      await Promise.all(
        items.map(async (item) => {
          const probe = await ffshift.probe(item.path);

          if (!probe.ok || !probe.info) {
            set((state) => ({
              tasks: state.tasks.map((t) =>
                t.id === item.id ? { ...t, status: 'unsupported', reason: probe.reason ?? '无法读取' } : t,
              ),
            }));
            return;
          }

          const convertible = probe.convertibility?.ok ?? true;
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === item.id
                ? {
                    ...t,
                    info: probe.info ?? null,
                    sizeBytes: probe.info?.sizeBytes ?? 0,
                    status: convertible ? 'ready' : 'unsupported',
                    reason: probe.convertibility?.reason ?? null,
                  }
                : t,
            ),
          }));

          const thumb = await ffshift.thumbnail(item.path, probe.info.durationSec);
          if (thumb.ok && thumb.dataUrl) {
            set((state) => ({
              tasks: state.tasks.map((t) => (t.id === item.id ? { ...t, thumbnail: thumb.dataUrl ?? null } : t)),
            }));
          }
        }),
      );
    },

    async startAll() {
      set((state) => ({
        tasks: state.tasks.map((t) => {
          if (t.status === 'ready') {
            return { ...t, status: 'queued', outcome: null, progress: null, reason: null };
          }
          // 失败的任务可以重来，但连续失败到 2 次就停下：多半是文件本身的问题，
          // 一路重试只会浪费用户时间。要用重试按钮才会再入队。
          if (t.status === 'failed' && t.failCount < MAX_AUTO_RETRY) {
            return { ...t, status: 'queued', outcome: null, progress: null, reason: null };
          }
          return t;
        }),
      }));
      await pump();
    },

    /** 队列推进：跑完一个接着下一个时用，不动其它任务的状态 */
    pumpNext: pump,

    retryTask(id) {
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id
            ? { ...t, status: 'ready', failCount: 0, errorRaw: null, reason: null, outcome: null, progress: null }
            : t,
        ),
      }));
    },

    async cancelTask(id) {
      await api()?.cancel(id);
    },

    removeTask(id) {
      set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    },

    clearFinished() {
      set((state) => ({ tasks: state.tasks.filter((t) => t.status !== 'done') }));
    },

    setPreset(preset) {
      set({ preset });
      void persistSettings(get());
    },

    setOutputFormat(format) {
      set({ outputFormat: format });
      void persistSettings(get());
    },

    setTargetSize(targetSizeMiB) {
      set({ targetSizeMiB });
    },

    applySuggestion(preset, targetSizeMiB) {
      set({ preset, targetSizeMiB });
      void persistSettings(get());
    },

    async pickOutputDir() {
      const folders = await api()?.pickFolder('选择输出目录');
      if (folders?.[0]) {
        set({ outputDir: folders[0] });
        void persistSettings(get());
      }
    },

    clearOutputDir() {
      set({ outputDir: null });
      void persistSettings(get());
    },

    async addFolder() {
      const folders = await api()?.pickFolder('选择要导入的文件夹');
      const folder = folders?.[0];
      if (!folder) return;
      const files = await api()?.scanFolder(folder);
      if (files?.length) await get().addFiles(files);
    },

    async detectHardware() {
      const report = await api()?.detectHardware();
      if (report) set({ hardware: report.available });
    },

    async loadSettings() {
      const settings = await api()?.loadSettings();
      if (settings) {
        set({ preset: settings.preset, outputFormat: settings.outputFormat, outputDir: settings.outputDir });
      }
    },
  };
});

/** 设置改动就落盘，下次启动还在（冒烟清单第 12 条）。 */
async function persistSettings(state: {
  preset: Preset;
  outputFormat: OutputFormat;
  outputDir: string | null;
}): Promise<void> {
  await api()?.saveSettings({
    version: 1,
    preset: state.preset,
    outputFormat: state.outputFormat,
    outputDir: state.outputDir,
    hw: 'none',
  });
}

/** 主进程推来的进度与结束事件：接一次就够，所以放在模块加载时绑定。 */
export function bindIpcEvents(): void {
  const ffshift = api();
  if (!ffshift) return;

  ffshift.onProgress(({ taskId, update }) => {
    useStore.setState((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, progress: update } : t)),
    }));
  });

  ffshift.onFinished(({ taskId, outcome }) => {
    const failed = outcome.status === 'failed';

    useStore.setState((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              outcome,
              status: outcome.status === 'done' ? 'done' : outcome.status === 'cancelled' ? 'cancelled' : 'failed',
              reason: failed ? outcome.error.title : null,
              // 原始输出留给"查看原始日志"；失败次数用来决定还要不要自动重试
              errorRaw: failed ? outcome.error.raw || null : null,
              failCount: failed ? t.failCount + 1 : t.failCount,
            }
          : t,
      ),
    }));

    // 只推进队列，不要调 startAll —— 那会把所有等待中的任务重新入队，等于重复排队
    void useStore.getState().pumpNext().catch(() => undefined);
  });

  void useStore.getState().detectHardware();
  void useStore.getState().loadSettings();
  void ffshift.ffmpegVersion().then((version) => useStore.setState({ ffmpegVersion: version }));

  // 自检与调试入口：命令行里可以直接驱动界面状态（自动截图、端到端走查都用它）
  (window as unknown as { __ffshift?: unknown }).__ffshift = {
    addFiles: (paths: string[]) => useStore.getState().addFiles(paths),
    startAll: () => useStore.getState().startAll(),
    state: () => useStore.getState(),
  };
}
