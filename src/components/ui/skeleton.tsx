import { cn } from '@/lib/utils';

/**
 * 骨架块。
 *
 * 高光扫过而不是整块呼吸：扫动说明"在读"，呼吸容易被当成"卡了"。
 * 高光颜色按主题取（`--skeleton-highlight`）：亮色下是一道更白的，暗色下是极淡的前景色。
 * 动画定义在 globals.css 的 @theme 里（`--animate-skeleton`）。
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'animate-skeleton rounded-sm [background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_var(--muted)_0_0/200%_100%_fixed]',
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
