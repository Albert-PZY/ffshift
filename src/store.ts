/**
 * 界面状态：任务列表 + 档位 + 设置。
 * 队列一次只跑一个任务（架构约定）；界面不直接碰 ffmpeg，全部走 window.ffshift。
 */
import { create } from 'zustand';
import type { ConvertOutcome, ProgressUpdate } from '../electron/ffmpeg/convert';
import { suggestOutputPath, type Preset } from './lib/ffmpeg-args';
import type { MediaInfo } from './lib/ffprobe';

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
}

const api = () => window.ffshift;

let sequence = 0;
const nextId = () => `task-${(sequence += 1)}`;

interface State {
  tasks: TaskItem[];
  preset: Preset;
  /** AI 建议里的目标体积（MiB）；null 表示不限体积 */
  targetSizeMiB: number | null;
  outputDir: string | null;
  hardware: string[];
  ffmpegVersion: string | null;
  addFiles: (paths: string[]) => Promise<void>;
  startAll: () => Promise<void>;
  cancelTask: (id: string) => Promise<void>;
  removeTask: (id: string) => void;
  clearFinished: () => void;
  setPreset: (preset: Preset) => void;
  /** 采纳 AI 建议：档位与目标体积一起生效（否则体积建议等于空话） */
  applySuggestion: (preset: Preset, targetSizeMiB: number | null) => void;
  pickOutputDir: () => Promise<void>;
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

    const output = next.output ?? suggestOutputPath(next.path);
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
      hw,
      hasAudio: next.info.hasAudio,
      durationSec: next.info.durationSec,
      targetSizeMiB: get().targetSizeMiB,
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
        tasks: state.tasks.map((t) => (t.status === 'ready' || t.status === 'failed' ? { ...t, status: 'queued', outcome: null, progress: null, reason: null } : t)),
      }));
      await pump();
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

    applySuggestion(preset, targetSizeMiB) {
      set({ preset, targetSizeMiB });
      void persistSettings(get());
    },

    async pickOutputDir() {
      const dir = await api()?.pickFiles();
      if (dir && dir[0]) {
        set({ outputDir: dir[0] });
        void persistSettings(get());
      }
    },

    async detectHardware() {
      const report = await api()?.detectHardware();
      if (report) set({ hardware: report.available });
    },

    async loadSettings() {
      const settings = await api()?.loadSettings();
      if (settings) {
        set({ preset: settings.preset, outputDir: settings.outputDir });
      }
    },
  };
});

/** 设置改动就落盘，下次启动还在（冒烟清单第 12 条）。 */
async function persistSettings(state: { preset: Preset; outputDir: string | null }): Promise<void> {
  await api()?.saveSettings({
    version: 1,
    preset: state.preset,
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
    useStore.setState((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              outcome,
              status:
                outcome.status === 'done' ? 'done' : outcome.status === 'cancelled' ? 'cancelled' : 'failed',
              reason: outcome.status === 'failed' ? outcome.error.title : null,
            }
          : t,
      ),
    }));
    // 一个跑完就接着跑下一个
    void useStore.getState().startAll().catch(() => undefined);
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
