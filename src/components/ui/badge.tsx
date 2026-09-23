import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * 小标签。
 *
 * 语义色的用法是「12% 底 + 同色字」——底色只是提示，颜色由文字承担，
 * 所以对比度按文字算（见 globals.css 里对 destructive / success 取值的说明）。
 * 尺寸比上游大一档：上游 sm 那一档在 14px 基准下只有 10px，
 * 中文在 10px 上糊成一团。
 */
const badgeVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm border border-transparent font-medium outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-3.5 sm:[&_svg:not([class*='size-'])]:size-3 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-5.5 min-w-5.5 px-1 text-sm sm:h-5 sm:min-w-5 sm:text-xs',
        lg: 'h-6.5 min-w-6.5 px-1.5 text-base sm:h-5.5 sm:min-w-5.5 sm:text-sm',
        sm: 'h-5 min-w-5 rounded-[calc(var(--radius-sm)-2px)] px-1 text-xs sm:h-4.5 sm:min-w-4.5',
      },
      variant: {
        default: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        error: 'bg-destructive/16 text-destructive',
        info: 'bg-info/16 text-info',
        outline: 'border-border bg-transparent',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-success/16 text-success',
        warning: 'bg-warning/16 text-warning',
      },
    },
  },
);

interface BadgeProps extends useRender.ComponentProps<'span'> {
  variant?: VariantProps<typeof badgeVariants>['variant'];
  size?: VariantProps<typeof badgeVariants>['size'];
}

function Badge({ className, variant, size, render, ...props }: BadgeProps) {
  const defaultProps = {
    className: cn(badgeVariants({ className, size, variant })),
    'data-slot': 'badge',
  };

  return useRender({
    defaultTagName: 'span',
    props: mergeProps<'span'>(defaultProps, props),
    render,
  });
}

export { Badge, badgeVariants };
