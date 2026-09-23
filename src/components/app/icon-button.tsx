import { cn } from '@/lib/utils';

/**
 * 方形图标按钮。
 *
 * 桌面工具里最高频的一类控件，所以只允许一种形态：正方形 + 圆角 md +
 * 次要色图标，hover 才变面色与文字色。给不给文字由 aria-label 与 title 补齐——
 * 图标按钮必须能说清自己是什么。
 */
export function IconButton({
  label,
  onActivate,
  size = 'sm',
  tone = 'default',
  className,
  disabled,
  children,
}: {
  label: string;
  onActivate: () => void;
  size?: 'sm' | 'md';
  tone?: 'default' | 'danger';
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-64',
        size === 'sm' ? 'h-7 w-7' : 'h-8 w-8',
        tone === 'danger' ? 'hover:bg-destructive/16 hover:text-destructive' : 'hover:bg-accent/50 hover:text-foreground',
        className,
      )}
      onClick={onActivate}
    >
      {children}
    </button>
  );
}
