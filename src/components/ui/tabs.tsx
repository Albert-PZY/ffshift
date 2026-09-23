import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
import { cn } from '@/lib/utils';

/**
 * 分段切换。
 *
 * 默认变体是「凹槽 + 滑块」：外层 `bg-muted` 的圆角槽，选中项是一块
 * `bg-background shadow-sm` 的滑块，位移交给 base-ui 的 indicator。
 * 比"选中的那个按钮换底色"更能说明"这是一组互斥选项"，也不会被误当成按钮。
 */
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      className={cn('flex flex-col gap-2 data-[orientation=vertical]:flex-row', className)}
      data-slot="tabs"
      {...props}
    />
  );
}

function TabsList({
  variant = 'default',
  className,
  children,
  ...props
}: TabsPrimitive.List.Props & { variant?: 'default' | 'underline' }) {
  return (
    <TabsPrimitive.List
      className={cn(
        'relative z-0 flex w-fit items-center justify-center gap-x-0.5 text-muted-foreground',
        'data-[orientation=vertical]:flex-col',
        variant === 'default'
          ? 'rounded-lg bg-muted p-0.5 text-muted-foreground/72'
          : 'data-[orientation=horizontal]:py-1 *:data-[slot=tabs-trigger]:hover:bg-accent',
        className,
      )}
      data-slot="tabs-list"
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator
        className={cn(
          '-translate-y-(--active-tab-bottom) absolute bottom-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) transition-[width,translate] duration-200 ease-in-out',
          variant === 'underline'
            ? 'z-10 bg-primary data-[orientation=horizontal]:h-0.5 data-[orientation=horizontal]:translate-y-px'
            : '-z-1 rounded-md bg-background shadow-sm',
        )}
        data-slot="tab-indicator"
      />
    </TabsPrimitive.List>
  );
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "[&_svg]:-mx-0.5 flex shrink-0 grow cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-base outline-none transition-[color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-disabled:opacity-64 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        'hover:text-muted-foreground data-active:text-foreground',
        'h-9 gap-1.5 px-2 sm:h-8',
        'data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start',
        className,
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  );
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      className={cn(
        'flex-1 outline-none',
        'transition-opacity duration-150 ease-out',
        'data-[hidden]:pointer-events-none data-[hidden]:opacity-0',
        'not-data-[hidden]:opacity-100',
        className,
      )}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsPanel, TabsPanel as TabsContent, TabsTab, TabsTab as TabsTrigger };
