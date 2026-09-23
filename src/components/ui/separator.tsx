import { Separator as SeparatorPrimitive } from '@base-ui/react/separator';
import { cn } from '@/lib/utils';

/**
 * 分隔线。1px，颜色走 --border。
 *
 * 优先用容器自己的 border-*；只有在同一容器里要插一条"带内缩"的线时才用它。
 */
function Separator({ className, orientation = 'horizontal', ...props }: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      className={cn(
        'shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px',
        className,
      )}
      data-slot="separator"
      orientation={orientation}
      {...props}
    />
  );
}

export { Separator };
