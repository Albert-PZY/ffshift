import { Select as SelectPrimitive } from '@base-ui/react/select';
import { ChevronDownIcon, ChevronsUpDownIcon, ChevronUpIcon } from 'lucide-react';
import { Z_INDEX } from '@/lib/z-index';
import { cn } from '@/lib/utils';

/**
 * 下拉选择。
 *
 * 触发器与输入框同款（`rounded-lg border border-input`、`bg-input/32`、
 * focus 时 `border-ring` + 3px 焦点环），这样"要填的地方"看起来是同一种东西。
 * 弹层走 `bg-popover` + 1px 描边 + `shadow-lg`，入场 150ms 微回弹。
 */
const Select = SelectPrimitive.Root;

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.Trigger.Props & { size?: 'sm' | 'default' | 'lg' }) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        "relative inline-flex min-h-9 w-full min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border border-input bg-field bg-clip-padding px-2.5 text-left text-base text-foreground shadow-xs outline-none ring-ring/24 transition-shadow select-none focus-visible:border-ring focus-visible:ring-[3px] aria-invalid:border-destructive/36 data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-8 sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        size === 'sm' && 'min-h-8 gap-1.5 px-2 sm:min-h-7',
        size === 'lg' && 'min-h-10 sm:min-h-9',
        className,
      )}
      data-slot="select-trigger"
      {...props}
    >
      {children}
      <SelectPrimitive.Icon data-slot="select-icon">
        <ChevronsUpDownIcon className="-me-1 size-4.5 opacity-80 sm:size-4" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      className={cn('flex-1 truncate data-placeholder:text-muted-foreground', className)}
      data-slot="select-value"
      {...props}
    />
  );
}

function SelectPopup({
  className,
  children,
  sideOffset = 4,
  ...props
}: SelectPrimitive.Popup.Props & { sideOffset?: SelectPrimitive.Positioner.Props['sideOffset'] }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        alignItemWithTrigger={false}
        className="select-none"
        data-slot="select-positioner"
        sideOffset={sideOffset}
        style={{ zIndex: Z_INDEX.DROPDOWN }}
      >
        <SelectPrimitive.Popup
          className="origin-(--transform-origin) transition-[scale,opacity] duration-150 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:scale-98 data-starting-style:opacity-0"
          data-slot="select-popup"
          {...props}
        >
          <span className="relative block rounded-lg border bg-popover shadow-lg">
            <SelectPrimitive.ScrollUpArrow
              className="top-0 z-50 flex h-6 w-full cursor-default items-center justify-center bg-popover"
              data-slot="select-scroll-up-arrow"
            >
              <ChevronUpIcon className="relative size-4.5 sm:size-4" />
            </SelectPrimitive.ScrollUpArrow>
            <SelectPrimitive.List
              className={cn('max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto p-1', className)}
              data-slot="select-list"
            >
              {children}
            </SelectPrimitive.List>
            <SelectPrimitive.ScrollDownArrow
              className="bottom-0 z-50 flex h-6 w-full cursor-default items-center justify-center bg-popover"
              data-slot="select-scroll-down-arrow"
            >
              <ChevronDownIcon className="relative size-4.5 sm:size-4" />
            </SelectPrimitive.ScrollDownArrow>
          </span>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "grid cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none data-disabled:pointer-events-none data-disabled:opacity-64 data-highlighted:bg-accent data-highlighted:text-accent-foreground sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-slot="select-item"
      {...props}
    >
      <SelectPrimitive.ItemIndicator className="col-start-1">
        <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
          <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
        </svg>
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="col-start-2 min-w-0">{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator className={cn('mx-1 my-1 h-px bg-border', className)} data-slot="select-separator" {...props} />
  );
}

function SelectGroup(props: SelectPrimitive.Group.Props) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectGroupLabel(props: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      className="px-2 py-1.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
      data-slot="select-group-label"
      {...props}
    />
  );
}

export { Select, SelectGroup, SelectGroupLabel, SelectItem, SelectPopup, SelectSeparator, SelectTrigger, SelectValue };
