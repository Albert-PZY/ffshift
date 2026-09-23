import { FolderOpen } from 'lucide-react';
import { IconButton } from '@/components/app/icon-button';
import { StatusBadge } from '@/components/app/status-badge';
import { formatSizeDelta } from '@/lib/format';
import { formatLabel } from '@/lib/output-formats';
import type { HistoryEntry } from '@/lib/settings';

/**
 * 历史记录的一行。
 *
 * 与队列行同一个骨架，但不要缩略图：历史是"回看结果"，看的是体积变化与时间，
 * 再挂一张 96×54 的图只会让一屏里塞不下几条记录。
 */
export function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const delta = formatSizeDelta(entry.inputSizeBytes, entry.outputSizeBytes);
  const when = entry.finishedAt ? new Date(entry.finishedAt).toLocaleString('zh-CN', { hour12: false }) : null;
  const elapsed = entry.elapsedMs > 0 ? `${(entry.elapsedMs / 1000).toFixed(1)} 秒` : null;

  const meta = [formatLabel(entry.format), delta, elapsed, when].filter(Boolean).join(' · ');

  return (
    <article
      className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/70"
      data-slot="task-row"
      data-status={entry.status}
    >
      <div className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-medium" title={entry.inputPath}>
          {entry.name}
        </strong>
        <p className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums" data-slot="task-meta">
          {meta}
        </p>
      </div>

      <StatusBadge status={entry.status === 'done' ? 'done' : 'failed'} />

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        {entry.outputPath && (
          <IconButton
            label={`打开 ${entry.name} 的输出目录`}
            onActivate={() => void window.ffshift?.revealOutput(entry.outputPath ?? '')}
          >
            <FolderOpen className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>
    </article>
  );
}
