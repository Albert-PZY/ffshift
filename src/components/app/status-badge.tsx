import { statusLabel, statusTone, type TaskStatus, type TaskTone } from '@/lib/task-status';
import { cn } from '@/lib/utils';

/**
 * 状态标签：一个圆点 + 中文。
 *
 * 圆点跟文字同色（`bg-current`），所以只有一处需要维护颜色。
 * 状态永远不只靠颜色表达——色盲用户看到的是文字，不是绿点。
 */
const TONE_TEXT: Record<TaskTone, string> = {
  neutral: 'text-muted-foreground',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const tone = statusTone(status);

  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1.5 text-xs', TONE_TEXT[tone], className)}
      data-slot="task-status"
      data-status={status}
      data-tone={tone}
    >
      <i aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}
