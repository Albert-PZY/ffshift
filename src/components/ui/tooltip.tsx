import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import { Z_INDEX } from '@/lib/z-index';
import { cn } from '@/lib/utils';

/**
 * 悬浮提示。
 *
 * 入场用 150ms 的 `cubic-bezier(0.34, 1.56, 0.64, 1)`（轻微回弹）配 `scale-95 → 1`：
 * 是本设计语言里浮层的统一入场方式，dropdown / dialog / tooltip 一致。
 */
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;

function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipPopup({
  className,
  align = 'center',
  sideOffset = 4,
  side = 'top',
  children,
  ...props
}: TooltipPrimitive.Popup.Props & {
  align?: TooltipPrimitive.Positioner.Props['align'];
  side?: TooltipPrimitive.Positioner.Props['side'];
  sideOffset?: TooltipPrimitive.Positioner.Props['sideOffset'];
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        className="h-(--positioner-height) w-(--positioner-width) max-w-(--available-width)"
        data-slot="tooltip-positioner"
        side={side}
        sideOffset={sideOffset}
        style={{ zIndex: Z_INDEX.TOOLTIP }}
      >
        <TooltipPrimitive.Popup
          className={cn(
            'relative origin-(--transform-origin) rounded-md border bg-popover px-2 py-1 text-xs text-balance text-popover-foreground shadow-md transition-[scale,opacity] duration-150 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            className,
          )}
          data-slot="tooltip-popup"
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipPopup, TooltipPopup as TooltipContent, TooltipProvider, TooltipTrigger };
