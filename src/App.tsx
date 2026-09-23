/**
 * 主界面：三栏工作台。
 *
 *   左栏：批量设置（档位、输出格式）+ AI 建议 + 文件操作
 *   中栏：转换队列
 *   右栏：选中任务的真实媒体信息
 *
 * 布局参考 v0.app 生成的版本；数据与动作全部接真实的 store 与 IPC ——
 * 界面上的每个控件都对应一个已实现的能力。v0 原稿里的编码器选择、CRF 滑块、
 * 音频与帧率下拉都不在这里：后端是按档位固定参数的，做出来只会骗用户。
 */
import { useEffect, useRef, useState, type DragEvent } from 'react';
import {
  Check,
  ChevronDown,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { describeSuggestion, type Suggestion } from './lib/ai-suggest';
import { formatBytes, formatDuration, formatPercent, formatRemaining, formatSpeed } from './lib/format';
import type { OutputFormat, Preset } from './lib/ffmpeg-args';
import { useStore, type TaskItem } from './store';

const PRESETS: Array<{ id: Preset; label: string; note: string }> = [
  { id: 'clear', label: '更清晰', note: '存档、还要再剪辑' },
  { id: 'balanced', label: '均衡', note: '日常使用' },
  { id: 'small', label: '更小', note: '发手机、省空间' },
];

/** 输出格式按用途分组：视频 / 动图 / 音频（从视频里提取声音） */
const FORMAT_OPTIONS: Array<{ value: OutputFormat; label: string; note: string }> = [
  { value: 'same', label: '保持原格式', note: '跟随源文件容器' },
  { value: 'mp4', label: 'MP4', note: '最通用' },
  { value: 'mkv', label: 'MKV', note: '装得下几乎一切' },
  { value: 'mov', label: 'MOV', note: '苹果生态' },
  { value: 'webm', label: 'WebM', note: '网页、体积小' },
  { value: 'gif', label: 'GIF', note: '动图，自动调色板' },
  { value: 'mp3', label: 'MP3', note: '只留声音' },
  { value: 'm4a', label: 'M4A', note: '只留声音' },
  { value: 'opus', label: 'Opus', note: '只留声音' },
  { value: 'flac', label: 'FLAC', note: '只留声音，无损' },
  { value: 'wav', label: 'WAV', note: '只留声音，无损' },
];

const STATUS_LABEL: Record<TaskItem['status'], string> = {
  reading: '读取中',
  ready: '待转换',
  queued: '排队中',
  running: '转换中',
  done: '已完成',
  failed: '失败',
  cancelled: '已取消',
  unsupported: '不支持',
};

/** 目标体积输入：空 → 不限；越界收敛到 1–10000，不把 NaN 或负数传下去 */
function readTargetSize(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 1) return null;
  return Math.round(Math.min(value, 10_000));
}

/** 体积对比：源 → 产物，带增减百分比。数据不全时返回 null，界面显示 — */
function describeSizeChange(task: TaskItem): string | null {
  const output = task.outcome?.status === 'done' ? task.outcome.outputSizeBytes : null;
  if (!output || !task.sizeBytes) return null;

  const delta = Math.round(((output - task.sizeBytes) / task.sizeBytes) * 100);
  const sign = delta > 0 ? '+' : '';
  return `${formatBytes(task.sizeBytes)} → ${formatBytes(output)}（${sign}${delta}%）`;
}

/** 自定义下拉：原生 select 太系统化，这里做成菜单，支持外部点击与 Esc 关闭 */
function Menu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string; note?: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const current = options.find((item) => item.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="menu" ref={boxRef}>
      <button
        type="button"
        className="menu-trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
      >
        <span>{current?.label ?? '—'}</span>
        <ChevronDown className={open ? 'is-open' : ''} />
      </button>

      {open && (
        <div className="menu-popover" role="listbox" aria-label={ariaLabel}>
          {options.map((item) => (
            <button
              type="button"
              key={item.value}
              role="option"
              aria-selected={item.value === value}
              className={`menu-item ${item.value === value ? 'active' : ''}`}
              onClick={() => {
                onChange(item.value);
                setOpen(false);
              }}
            >
              <span>{item.label}</span>
              {item.note && <small>{item.note}</small>}
              {item.value === value && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** 进度条：时长未知时走不确定态，不让用户误以为卡在某个固定百分比 */
function ProgressBar({ task }: { task: TaskItem }) {
  const percent = task.progress?.percent ?? null;
  const indeterminate = percent === null && task.status === 'running';

  return (
    <div className={`progress ${indeterminate ? 'is-indeterminate' : ''}`}>
      <i
        className={task.status === 'done' ? 'is-done' : ''}
        style={indeterminate ? undefined : { width: `${Math.round((percent ?? 0) * 100)}%` }}
      />
    </div>
  );
}

/** 一行任务：缩略图 + 名称 + 媒体信息 + 状态 + 该状态下可用的动作 */
function QueueRow({ task, selected, onSelect }: { task: TaskItem; selected: boolean; onSelect: () => void }) {
  const cancelTask = useStore((s) => s.cancelTask);
  const removeTask = useStore((s) => s.removeTask);
  const retryTask = useStore((s) => s.retryTask);

  const running = task.status === 'running';
  const finished = ['done', 'failed', 'cancelled', 'unsupported'].includes(task.status);

  return (
    <article
      className={`queue-row ${selected ? 'is-selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${task.name}，${STATUS_LABEL[task.status]}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect();
      }}
    >
      <div className="thumb">
        {task.thumbnail ? (
          <img src={task.thumbnail} alt="" />
        ) : (
          <span className="thumb-empty">{task.status === 'reading' ? '读取中' : '无预览'}</span>
        )}
      </div>

      <div className="queue-main">
        <div className="queue-title">
          <strong title={task.path}>{task.name}</strong>
          <span className={`status status-${task.status}`}>
            <i />
            {STATUS_LABEL[task.status]}
          </span>
        </div>

        <span className="queue-meta">
          {task.info
            ? [
                task.info.durationSec !== null ? formatDuration(task.info.durationSec) : '时长未知',
                task.info.width ? `${task.info.width}×${task.info.height ?? '?'}` : null,
                task.sizeBytes ? formatBytes(task.sizeBytes) : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : (task.reason ?? '正在读取…')}
        </span>

        {running && (
          <div className="progress-row">
            <ProgressBar task={task} />
            <small>
              {task.progress?.percent != null ? formatPercent(task.progress.percent) : '进行中'}
              {task.progress?.remainingSec != null ? ` · 剩余 ${formatRemaining(task.progress.remainingSec)}` : ''}
              {task.progress?.speed ? ` · ${formatSpeed(task.progress.speed)}` : ''}
            </small>
          </div>
        )}
      </div>

      <div className="row-actions" onClick={(event) => event.stopPropagation()}>
        {running && (
          <button
            type="button"
            className="row-action"
            title="取消"
            aria-label={`取消 ${task.name}`}
            onClick={() => void cancelTask(task.id)}
          >
            <X />
          </button>
        )}
        {task.status === 'failed' && (
          <button
            type="button"
            className="row-action"
            title="重试"
            aria-label={`重试 ${task.name}`}
            onClick={() => retryTask(task.id)}
          >
            <RotateCcw />
          </button>
        )}
        {finished && (
          <button
            type="button"
            className="row-action is-danger"
            title="移除"
            aria-label={`移除 ${task.name}`}
            onClick={() => removeTask(task.id)}
          >
            <Trash2 />
          </button>
        )}
      </div>
    </article>
  );
}

/** 详情栏：选中任务的完整媒体信息；字段缺失显示 —，不显示 NaN */
function Inspector({ task, onClose }: { task: TaskItem; onClose: () => void }) {
  const info = task.info;
  const [copied, setCopied] = useState(false);

  /** 复制原始日志给能帮忙排查的人；剪贴板不可用时静默失败，不打断用户 */
  const copyLog = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 忽略：Electron 里一般都能用 */
    }
  };

  const field = (label: string, value: string | null) => (
    <div className="field">
      <dt>{label}</dt>
      <dd className={value ? '' : 'is-empty'}>{value ?? '—'}</dd>
    </div>
  );

  return (
    <aside className="inspector">
      <div className="inspector-head">
        <div>
          <span className="kicker">任务详情</span>
          <h2 title={task.path}>{task.name}</h2>
        </div>
        <button type="button" className="icon-button" aria-label="收起详情" onClick={onClose}>
          <X />
        </button>
      </div>

      <div className="inspector-body">
        <div className="inspector-preview">
          {task.thumbnail ? <img src={task.thumbnail} alt="" /> : <span>无预览</span>}
        </div>

        {task.reason && <p className="reason">{task.reason}</p>}

        {task.failCount >= 2 && (
          <p className="reason">
            已连续失败 {task.failCount} 次，多半是文件本身的问题。处理完之后点行内的「重试」。
          </p>
        )}

        {task.errorRaw && (
          <details className="raw-log">
            <summary>查看原始日志</summary>
            <pre>{task.errorRaw}</pre>
            <button
              type="button"
              className="secondary-button full"
              onClick={() => void copyLog(task.errorRaw ?? '')}
            >
              {copied ? '已复制' : '复制日志'}
            </button>
          </details>
        )}

        <p className="field-group-title">媒体信息</p>
        {field('时长', info?.durationSec != null ? formatDuration(info.durationSec) : null)}
        {field('分辨率', info?.width ? `${info.width} × ${info.height ?? '?'}` : null)}
        {field('帧率', info?.fps ? `${info.fps} fps` : null)}
        {field('视频编码', info?.videoCodec ?? null)}
        {field('音频编码', info?.audioCodec ?? null)}
        {field('声道', info?.channels != null ? String(info.channels) : null)}
        {field('容器', info?.container ?? null)}
        {field('码率', info?.bitrateKbps != null ? `${info.bitrateKbps} kbps` : null)}
        {field('像素格式', info?.pixelFormat ?? null)}
        {field('体积', task.sizeBytes ? formatBytes(task.sizeBytes) : null)}

        <p className="field-group-title">处理</p>
        {field('状态', STATUS_LABEL[task.status])}
        {field('体积变化', describeSizeChange(task))}
        {field('输出文件', task.output ? (task.output.split(/[\\/]/).pop() ?? null) : null)}
      </div>

      <div className="inspector-foot">
        {task.status === 'done' && task.output && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => void window.ffshift?.revealOutput(task.output ?? '')}
          >
            <FolderOpen />
            打开输出目录
          </button>
        )}
        <button type="button" className="secondary-button" onClick={onClose}>
          收起
        </button>
      </div>
    </aside>
  );
}

/** AI 建议：一句话说用途；降级到本地规则时如实标注来源 */
function Assistant({ onApply }: { onApply: (preset: Preset, targetSizeMiB: number | null) => void }) {
  const [idea, setIdea] = useState('');
  const [advice, setAdvice] = useState<{ suggestion: Suggestion; text: string; note: string } | null>(null);
  const [thinking, setThinking] = useState(false);

  const ask = async () => {
    if (!window.ffshift || idea.trim().length === 0) return;
    setThinking(true);
    try {
      const response = await window.ffshift.suggest(idea);
      setAdvice({
        suggestion: response.suggestion,
        text: describeSuggestion(response.suggestion),
        note: response.note,
      });
    } finally {
      setThinking(false);
    }
  };

  return (
    <section className="rail-section">
      <label>让 AI 给建议</label>
      <div className="assistant">
        <input
          className="idea-input"
          placeholder="一句话说用途，比如：压到 50MB 发微信"
          value={idea}
          aria-label="描述用途"
          onChange={(event) => setIdea(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void ask();
          }}
        />
        <button
          type="button"
          className="secondary-button full"
          disabled={thinking || idea.trim().length === 0}
          onClick={() => void ask()}
        >
          <Sparkles />
          {thinking ? '正在想…' : '给出建议'}
        </button>

        {advice && (
          <div className="advice">
            <span className={`advice-tag ${advice.suggestion.source === 'ai' ? 'is-ai' : ''}`}>
              {advice.suggestion.source === 'ai' ? '模型建议' : '本地规则'}
            </span>
            <span className="advice-text">
              {advice.text}
              <span className="advice-note">（{advice.note}）</span>
            </span>
            <button
              type="button"
              className="secondary-button full"
              onClick={() => onApply(advice.suggestion.preset, advice.suggestion.targetSizeMiB)}
            >
              用这个档
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function App() {
  const {
    tasks,
    preset,
    outputFormat,
    outputDir,
    targetSizeMiB,
    hardware,
    ffmpegVersion,
    addFiles,
    startAll,
    setPreset,
    setOutputFormat,
    setTargetSize,
    applySuggestion,
    pickOutputDir,
    clearOutputDir,
    addFolder,
    clearFinished,
  } = useStore();

  const [dragging, setDragging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const selected = tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null;
  const runnableCount = tasks.filter((task) => task.status === 'ready' || task.status === 'failed').length;
  const runningCount = tasks.filter((task) => task.status === 'running').length;

  const pickFiles = async () => {
    const paths = await window.ffshift?.pickFiles();
    if (paths?.length) await addFiles(paths);
  };

  /** 拖放要走真实路径：Electron 里 File 对象拿不到磁盘路径，需经 preload 的 webUtils */
  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => window.ffshift?.getPathForFile(file))
      .filter((path): path is string => Boolean(path));
    if (paths.length) await addFiles(paths);
  };

  return (
    <main
      className="ffshift"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => void handleDrop(event)}
    >
      <div className={`app-shell ${railOpen ? '' : 'rail-hidden'}`}>
        <header className="topbar">
          <div className="brand">
            <button
              type="button"
              className="icon-button"
              aria-label={railOpen ? '收起设置栏' : '展开设置栏'}
              onClick={() => setRailOpen((open) => !open)}
            >
              {railOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </button>
            <div className="brand-mark">F</div>
            <strong>FFShift</strong>
            <span className="topbar-divider" />
            <span className="topbar-context">ffmpeg 的换挡键</span>
          </div>
          <div className="topbar-actions">
            <span title="编码器可用情况">
              <span className={`engine-dot ${hardware.length > 0 ? '' : 'is-off'}`} />
              {hardware.length > 0 ? `硬件加速：${hardware.join(' / ')}` : 'CPU 编码'}
            </span>
            <span title={ffmpegVersion ?? ''}>
              {ffmpegVersion ? ffmpegVersion.split(' ').slice(0, 3).join(' ') : '未检测到 ffmpeg'}
            </span>
          </div>
        </header>

        {railOpen && (
          <aside className="left-rail">
            <div className="rail-title">
              <span className="kicker">转换设置</span>
            </div>

            <section className="rail-section">
              <label htmlFor="preset-menu">质量档位</label>
              <Menu
                ariaLabel="质量档位"
                value={preset}
                onChange={setPreset}
                options={PRESETS.map((item) => ({ value: item.id, label: item.label, note: item.note }))}
              />

              <label htmlFor="format-menu">输出格式</label>
              <Menu
                ariaLabel="输出格式"
                value={outputFormat}
                onChange={setOutputFormat}
                options={FORMAT_OPTIONS}
              />

              <label>输出目录</label>
              <button
                type="button"
                className="path-button"
                title={outputDir ?? '与源文件同目录'}
                onClick={() => void pickOutputDir()}
              >
                <FolderOpen />
                <span>{outputDir ? (outputDir.split(/[\\/]/).pop() ?? outputDir) : '与源文件同目录'}</span>
              </button>
              {outputDir && (
                <button type="button" className="secondary-button full" onClick={clearOutputDir}>
                  恢复默认目录
                </button>
              )}

              <label htmlFor="target-size">目标体积（MiB）</label>
              <input
                id="target-size"
                className="size-input"
                type="number"
                min={1}
                max={10000}
                placeholder="不限"
                value={targetSizeMiB ?? ''}
                onChange={(event) => setTargetSize(readTargetSize(event.target.value))}
              />
            </section>

            <Assistant onApply={applySuggestion} />

            <div className="rail-spacer" />

            <button type="button" className="secondary-button full" onClick={() => void pickFiles()}>
              <Plus />
              添加视频
            </button>
            <button type="button" className="secondary-button full" onClick={() => void addFolder()}>
              <FolderOpen />
              导入文件夹
            </button>
            <button type="button" className="secondary-button full" onClick={() => void clearFinished()}>
              <Trash2 />
              清空已完成
            </button>
          </aside>
        )}

        <section className="workspace">
          <div className="workspace-head">
            <div>
              <span className="kicker">工作区</span>
              <h1>转换队列</h1>
            </div>
            <div className="head-actions">
              <span className="count-pill">{tasks.length} 个文件</span>
              <button type="button" className="secondary-button" onClick={() => setInspectorOpen((open) => !open)}>
                {inspectorOpen ? '收起详情' : '打开详情'}
              </button>
            </div>
          </div>

          <button
            type="button"
            className={`dropzone ${dragging ? 'is-dragging' : ''}`}
            onClick={() => void pickFiles()}
          >
            <Upload />
            <span>拖入视频，或点击添加</span>
            <small>支持 MP4、MOV、MKV、WebM、AVI</small>
          </button>

          {tasks.length === 0 ? (
            <div className="empty-state">
              <p>把视频拖进来，或者点上面的「添加视频」。</p>
              <small>支持 mp4、mov、mkv、avi、webm 等常见格式。</small>
            </div>
          ) : (
            <div className="queue-list">
              {tasks.map((task) => (
                <QueueRow
                  key={task.id}
                  task={task}
                  selected={selected?.id === task.id}
                  onSelect={() => {
                    setSelectedId(task.id);
                    setInspectorOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        {inspectorOpen && selected && <Inspector task={selected} onClose={() => setInspectorOpen(false)} />}

        <footer className="bottom-bar">
          <div>
            <span className={`live-dot ${runningCount > 0 ? '' : 'is-off'}`} />
            {tasks.length === 0
              ? '还没有文件'
              : `共 ${tasks.length} 个 · 待转换 ${runnableCount} 个${
                  runningCount ? ` · 正在进行 ${runningCount} 个` : ''
                }`}
            <span className="muted">· 输出到原文件夹</span>
          </div>
          <button
            type="button"
            className="primary-button start"
            disabled={runnableCount === 0}
            onClick={() => void startAll()}
          >
            <Play />
            {runningCount > 0 ? '继续排队' : '开始转换'}
          </button>
        </footer>
      </div>

      {dragging && (
        <div className="drop-overlay">
          <Upload />
          <span>松开以添加视频</span>
        </div>
      )}
    </main>
  );
}
