import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import { cn } from '@/lib/utils';

/**
 * 进度条。槽 1.5（5.25px）高、全圆角，指示器走语义状态色。
 *
 * 与上游的两处差异：
 *   1. 指示器不是反白（primary），而是按状态取色——转换中蓝、完成绿。
 *      反白的话"进行中"和"已完成"没法区分，而这两件事正是这个界面最该一眼看清的。
 *   2. 时长读不出来时 `value` 传 null，走不定态（来回滑），不假装有个具体百分比。
 */
function Progress({
  className,
  tone = 'running',
  value,
  ...props
}: ProgressPrimitive.Root.Props & { tone?: 'running' | 'done' }) {
  return (
    <ProgressPrimitive.Root
      className={cn('flex w-full flex-col', className)}
      data-slot="progress"
      value={value}
      {...props}
    >
      <ProgressPrimitive.Track
        className="block h-1.5 w-full overflow-hidden rounded-full bg-input"
        data-slot="progress-track"
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'block h-full transition-[width] duration-500',
            // 不定态：没有值就没有宽度，用一段来回滑的色带表示"在动，但说不准还剩多久"
            'data-indeterminate:w-[35%] data-indeterminate:animate-indeterminate',
            tone === 'done' ? 'bg-success' : 'bg-info',
          )}
          data-slot="progress-indicator"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
