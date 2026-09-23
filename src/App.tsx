/**
 * 主界面：导入的文件排成一列，选档位与输出格式，按顺序转换。
 *
 * 布局对应 docs/design-system.md：顶栏放运行状态，工具栏放档位与格式，
 * 中间是任务列表，底部只有一个主动作（开始转换）。
 * 所有 ffmpeg 相关的事都走 window.ffshift（preload 暴露的白名单），界面不碰 Node。
 */
import { useState, type DragEvent } from 'react';
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
const FORMAT_GROUPS: Array<{ label: string; options: Array<{ id: OutputFormat; label: string }> }> = [
  {
    label: '视频',
    options: [
      { id: 'same', label: '保持原格式' },
      { id: 'mp4', label: 'MP4（最通用）' },
      { id: 'mkv', label: 'MKV（装得下几乎一切）' },
      { id: 'mov', label: 'MOV（苹果生态）' },
      { id: 'webm', label: 'WebM（网页、体积小）' },
    ],
  },
  { label: '动图', options: [{ id: 'gif', label: 'GIF（自动调色板）' }] },
  {
    label: '音频（只留声音）',
    options: [
      { id: 'mp3', label: 'MP3' },
      { id: 'm4a', label: 'M4A' },
      { id: 'opus', label: 'Opus' },
      { id: 'flac', label: 'FLAC（无损）' },
      { id: 'wav', label: 'WAV（无损）' },
    ],
  },
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

/**
 * AI 建议区：一句话描述用途，拿到档位建议。
 * 界面上会标出建议来自模型还是本地规则——降级发生时用户有权知道。
 */
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
    <section className="assistant">
      <input
        className="idea-input"
        placeholder="一句话说用途，比如：压到 50MB 发微信"
        value={idea}
        onChange={(event) => setIdea(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void ask();
        }}
        aria-label="描述用途"
      />
      <button
        type="button"
        className="btn-secondary"
        disabled={thinking || idea.trim().length === 0}
        onClick={() => void ask()}
      >
        {thinking ? '正在想…' : '让 AI 给建议'}
      </button>

      {advice && (
        <div className="advice">
          <span className={`advice-tag ${advice.suggestion.source === 'ai' ? 'is-ai' : 'is-rules'}`}>
            {advice.suggestion.source === 'ai' ? '模型建议' : '本地规则'}
          </span>
          <span className="advice-text">
            {advice.text}
            <span className="advice-note">（{advice.note}）</span>
          </span>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onApply(advice.suggestion.preset, advice.suggestion.targetSizeMiB)}
          >
            用这个档
          </button>
        </div>
      )}
    </section>
  );
}

/** 进度条：时长未知时走不确定态（来回滑动），不让用户误以为卡在某个固定百分比 */
function ProgressBar({ task }: { task: TaskItem }) {
  const percent = task.progress?.percent ?? null;
  const width = percent === null ? 100 : Math.round(percent * 100);
  const indeterminate = percent === null && task.status === 'running';

  return (
    <div className={`progress ${indeterminate ? 'is-indeterminate' : ''}`} aria-hidden={percent === null}>
      <div
        className={`progress-fill ${task.status === 'done' ? 'is-done' : ''}`}
        style={{ width: indeterminate ? '35%' : `${width}%` }}
      />
    </div>
  );
}

/** 一行任务：缩略图 + 媒体信息 + 状态 + 该状态下可用的动作 */
function TaskRow({ task }: { task: TaskItem }) {
  const cancelTask = useStore((s) => s.cancelTask);
  const removeTask = useStore((s) => s.removeTask);

  return (
    <li className="row">
      <div className="thumb">
        {task.thumbnail ? (
          <img src={task.thumbnail} alt="" />
        ) : (
          <span className="thumb-empty">{task.status === 'reading' ? '…' : '无图'}</span>
        )}
      </div>

      <div className="meta">
        <div className="name" title={task.path}>
          {task.name}
        </div>
        <div className="sub">
          {task.info ? (
            <>
              {task.info.durationSec !== null ? formatDuration(task.info.durationSec) : '时长未知'}
              {task.info.width ? ` · ${task.info.width}×${task.info.height ?? '?'}` : ''}
              {task.sizeBytes ? ` · ${formatBytes(task.sizeBytes)}` : ''}
            </>
          ) : (
            task.reason ?? '正在读取…'
          )}
        </div>
        {task.status === 'running' && (
          <div className="progress-line">
            <ProgressBar task={task} />
            <span className="progress-text">
              {task.progress?.percent !== null && task.progress?.percent !== undefined
                ? formatPercent(task.progress.percent)
                : '进行中'}
              {task.progress?.remainingSec != null ? ` · 剩余 ${formatRemaining(task.progress.remainingSec)}` : ''}
              {task.progress?.speed ? ` · ${formatSpeed(task.progress.speed)}` : ''}
            </span>
          </div>
        )}
      </div>

      <div className="right">
        <span className={`status status-${task.status}`}>{STATUS_LABEL[task.status]}</span>
        {task.status === 'running' && (
          <button type="button" className="btn-ghost" onClick={() => void cancelTask(task.id)}>
            取消
          </button>
        )}
        {task.status === 'done' && task.output && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void window.ffshift?.revealOutput(task.output ?? '')}
          >
            打开输出目录
          </button>
        )}
        {['done', 'failed', 'cancelled', 'unsupported'].includes(task.status) && (
          <button type="button" className="btn-ghost" onClick={() => removeTask(task.id)}>
            移除
          </button>
        )}
      </div>
    </li>
  );
}

export default function App() {
  const {
    tasks,
    preset,
    outputFormat,
    targetSizeMiB,
    addFiles,
    startAll,
    setPreset,
    setOutputFormat,
    applySuggestion,
    clearFinished,
    ffmpegVersion,
    hardware,
  } = useStore();
  const [dragging, setDragging] = useState(false);

  const pendingCount = tasks.filter((t) => t.status === 'ready' || t.status === 'failed').length;
  const runningCount = tasks.filter((t) => t.status === 'running').length;

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => window.ffshift?.getPathForFile(file))
      .filter((path): path is string => Boolean(path));
    await addFiles(paths);
  };

  return (
    <div
      className={`app ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => void handleDrop(event)}
    >
      <header className="bar">
        <div className="brand">
          <strong>FFShift</strong>
          <span className="tagline">ffmpeg 的换挡键</span>
        </div>
        <div className="bar-right">
          <span className="hint">
            {hardware.length > 0 ? `硬件加速可用：${hardware.join(' / ')}` : '使用 CPU 编码'}
          </span>
          <span className="hint" title={ffmpegVersion ?? ''}>
            {ffmpegVersion ? ffmpegVersion.split(' ').slice(0, 3).join(' ') : '未检测到 ffmpeg'}
          </span>
        </div>
      </header>

      <section className="toolbar">
        <div className="presets" role="radiogroup" aria-label="转换档位">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={preset === item.id}
              className={`chip ${preset === item.id ? 'is-active' : ''}`}
              onClick={() => setPreset(item.id)}
              title={item.note}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="format-picker">
          <span className="hint">输出格式</span>
          <select
            value={outputFormat}
            onChange={(event) => setOutputFormat(event.target.value as OutputFormat)}
            aria-label="输出格式"
          >
            {FORMAT_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {targetSizeMiB !== null && <span className="hint">目标体积 {targetSizeMiB} MiB</span>}
        <div className="toolbar-right">
          <button type="button" className="btn-ghost" onClick={() => void clearFinished()}>
            清空已完成
          </button>
          <button type="button" className="btn-secondary" onClick={() => void window.ffshift?.pickFiles().then((paths) => addFiles(paths ?? []))}>
            选择文件
          </button>
        </div>
      </section>

      <Assistant onApply={applySuggestion} />

      <main className="list">
        {tasks.length === 0 ? (
          <div className="empty">
            <p>把视频拖进来，或者点上面的「选择文件」。</p>
            <p className="empty-sub">支持 mp4、mov、mkv、avi、webm 等常见格式。</p>
          </div>
        ) : (
          <ul>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}
      </main>

      <footer className="actions">
        <span className="hint">
          {tasks.length === 0
            ? '还没有文件'
            : `共 ${tasks.length} 个 · 待转换 ${pendingCount} 个${runningCount ? ` · 正在进行 ${runningCount} 个` : ''}`}
        </span>
        <button type="button" className="btn-primary" disabled={pendingCount === 0} onClick={() => void startAll()}>
          {runningCount > 0 ? '继续排队' : '开始转换'}
        </button>
      </footer>
    </div>
  );
}
