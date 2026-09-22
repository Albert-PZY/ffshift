import { useState, type DragEvent } from 'react';
import { formatBytes, formatDuration, formatPercent, formatRemaining, formatSpeed } from './lib/format';
import type { Preset } from './lib/ffmpeg-args';
import { useStore, type TaskItem } from './store';

const PRESETS: Array<{ id: Preset; label: string; note: string }> = [
  { id: 'clear', label: '更清晰', note: '存档、还要再剪辑' },
  { id: 'balanced', label: '均衡', note: '日常使用' },
  { id: 'small', label: '更小', note: '发手机、省空间' },
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
  const { tasks, preset, addFiles, startAll, setPreset, clearFinished, ffmpegVersion, hardware } = useStore();
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
        <div className="toolbar-right">
          <button type="button" className="btn-ghost" onClick={() => void clearFinished()}>
            清空已完成
          </button>
          <button type="button" className="btn-secondary" onClick={() => void window.ffshift?.pickFiles().then((paths) => addFiles(paths ?? []))}>
            选择文件
          </button>
        </div>
      </section>

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
