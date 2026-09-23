import { RotateCcw, Trash2, X } from 'lucide-react';
import { IconButton } from '@/components/app/icon-button';
import { StatusBadge } from '@/components/app/status-badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBytes, formatDuration, formatPercent, formatRemaining, formatSpeed } from '@/lib/format';
import { isFinished, statusLabel } from '@/lib/task-status';
import { cn } from '@/lib/utils';
import { useStore, type TaskItem } from '@/store';

/**
 * 缩略图。
 *
 * 三种情况各有各的表现：读到了就显示图、正在读显示骨架、读不出来显示文字。
 * 不留大灰块——空的地方要说清为什么空。
 */
function Thumb({ task }: { task: TaskItem }) {
  return (
    <div
      className="relative h-[49px] w-24 shrink-0 overflow-hidden rounded-md border bg-muted/30"
      data-slot="thumb"
    >
      {task.thumbnail ? (
        <img alt="" className="h-full w-full object-cover" src={task.thumbnail} />
      ) : task.status === 'reading' ? (
        <Skeleton className="size-full rounded-none" />
      ) : (
        <span className="grid h-full place-items-center text-label text-muted-foreground">无预览</span>
      )}
    </div>
  );
}

/** 一行任务：缩略图 + 文件名 + 媒体信息 + 状态；动作只在 hover / 选中时出现 */
export function TaskRow({ task, selected, onSelect }: { task: TaskItem; selected: boolean; onSelect: () => void }) {
  const cancelTask = useStore((s) => s.cancelTask);
  const removeTask = useStore((s) => s.removeTask);
  const retryTask = useStore((s) => s.retryTask);

  const running = task.status === 'running';
  const percent = task.progress?.percent ?? null;

  const meta = task.info
    ? [
        task.info.durationSec !== null ? formatDuration(task.info.durationSec) : '时长未知',
        task.info.width ? `${task.info.width}×${task.info.height ?? '?'}` : null,
        task.sizeBytes ? formatBytes(task.sizeBytes) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : (task.reason ?? '正在读取…');

  return (
    <article
      aria-label={`${task.name}，${statusLabel(task.status)}`}
      className={cn(
        'group relative grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-3 rounded-lg px-3 py-2 transition-colors',
        // 选中与 hover 的区别不靠深浅（亮色下深浅差不动），靠左边那条 2px 的竖线
        selected
          ? 'bg-muted before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-info'
          : 'hover:bg-muted/70',
      )}
      data-selected={selected ? 'true' : undefined}
      data-slot="task-row"
      data-status={task.status}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <Thumb task={task} />

      <div className="min-w-0">
        <strong className="block truncate text-sm font-medium" title={task.path}>
          {task.name}
        </strong>

        <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums" data-slot="task-meta">
          {meta}
        </p>

        {running && (
          <div className="mt-1.5 flex items-center gap-2">
            <Progress className="max-w-80" value={percent === null ? null : percent * 100} />
            <span className="shrink-0 text-metric text-info tabular-nums">
              {percent !== null ? formatPercent(percent) : '进行中'}
              {task.progress?.remainingSec != null ? ` · 剩余 ${formatRemaining(task.progress.remainingSec)}` : ''}
              {task.progress?.speed ? ` · ${formatSpeed(task.progress.speed)}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* 状态固定在最右一列：行与行之间按同一列扫读，比跟在文件名后面好找 */}
      <StatusBadge status={task.status} />

      {/* 行内动作：默认隐身，hover / 选中 / 键盘聚焦时才出现，避免一屏按钮 */}
      <div
        className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 group-data-[selected]:opacity-100"
        onClick={(event) => event.stopPropagation()}
      >
        {running && (
          <IconButton label={`取消 ${task.name}`} onActivate={() => void cancelTask(task.id)}>
            <X className="h-3.5 w-3.5" />
          </IconButton>
        )}
        {task.status === 'failed' && (
          <IconButton label={`重试 ${task.name}`} onActivate={() => retryTask(task.id)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </IconButton>
        )}
        {isFinished(task.status) && (
          <IconButton label={`移除 ${task.name}`} onActivate={() => removeTask(task.id)} tone="danger">
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>
    </article>
  );
}
