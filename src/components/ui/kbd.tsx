import { cn } from '@/lib/utils';

/**
 * 快捷键提示。
 *
 * `font-sans` 是刻意的：等宽字体里的组合键（Ctrl+O）会显得比正文重，
 * 而这里要的只是"一个轻量的小方块"。
 */
function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<'kbd'>) {
  return <kbd className={cn('inline-flex items-center gap-1', className)} data-slot="kbd-group" {...props} />;
}

export { Kbd, KbdGroup };
