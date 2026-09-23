import { cn } from '@/lib/utils';

/**
 * 空态。
 *
 * 桌面工具的空态不该是一张插画，而应该是"一句话 + 一个动作"。
 * `EmptyMedia variant="icon"` 背后那两张旋转 ±10°、缩到 84% 的副本是上游的招牌细节：
 * 一点装饰，但不会喧宾夺主。
 */
function Empty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance rounded-xl border-dashed p-6 text-center md:p-12',
        className,
      )}
      data-slot="empty"
      {...props}
    />
  );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('flex max-w-sm flex-col items-center text-center', className)} data-slot="empty-header" {...props} />
  );
}

function EmptyMedia({ className, variant = 'default', ...props }: React.ComponentProps<'div'> & { variant?: 'default' | 'icon' }) {
  const base = cn(
    'flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
    variant === 'icon' &&
      "relative size-9 rounded-md border bg-card text-foreground shadow-sm [&_svg:not([class*='size-'])]:size-4.5",
    className,
  );

  return (
    <div className={cn('relative mb-6', className)} data-slot="empty-media" data-variant={variant} {...props}>
      {variant === 'icon' && (
        <>
          <div
            aria-hidden="true"
            className={cn(base, 'pointer-events-none absolute bottom-px origin-bottom-left -translate-x-0.5 -rotate-10 scale-84 shadow-none')}
          />
          <div
            aria-hidden="true"
            className={cn(base, 'pointer-events-none absolute bottom-px origin-bottom-right translate-x-0.5 rotate-10 scale-84 shadow-none')}
          />
        </>
      )}
      <div className={base} />
    </div>
  );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('t-rise text-lg leading-none font-medium', className)} data-slot="empty-title" {...props} />
  );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('t-rise t-rise-2 text-sm/relaxed text-muted-foreground', className)}
      data-slot="empty-description"
      {...props}
    />
  );
}

function EmptyContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm', className)}
      data-slot="empty-content"
      {...props}
    />
  );
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
