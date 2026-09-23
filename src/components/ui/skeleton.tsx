import { cn } from '@/lib/utils';

/**
 * 骨架块。
 *
 * 高光扫过而不是整块呼吸：扫动说明"在读"，呼吸容易被当成"卡了"。
 * 动画定义在 globals.css 的 @theme 里（`--animate-skeleton`）。
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'animate-skeleton rounded-sm [background:linear-gradient(120deg,transparent_40%,color-mix(in_oklab,var(--foreground)_4%,transparent),transparent_60%)_var(--muted)_0_0/200%_100%_fixed]',
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
