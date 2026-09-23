import { cn } from '@/lib/utils';

/**
 * 小节标题。不可点，字号压到 10px 并拉开字距，跟正文形成层级。
 *
 * 上游用 `uppercase` 是因为它的标签是英文；中文没有大小写，字距一样起作用，
 * 所以这条配方原样照抄。
 */
export function SectionLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p
      className={cn('text-label font-medium tracking-wide text-muted-foreground uppercase', className)}
      data-slot="section-label"
    >
      {children}
    </p>
  );
}
