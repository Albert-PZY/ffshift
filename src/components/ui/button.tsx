import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * 按钮。
 *
 * 取值来自 EnsoCode 的 button.tsx：圆角 lg、1px 实边框、`active:scale-[0.97]`
 * 的按下反馈、`focus-visible:ring-2` 的焦点环、`disabled:opacity-64` 的禁用态。
 * 两个尺寸档（base 与 sm:）在桌面宽度下取 sm: 那一档，也就是 h-8 / text-sm。
 *
 * `default` 变体是反白（浅底深字）：每屏只该出现一个，用在本项目的「开始转换」上。
 * 这是设计立场里"唯一主按钮"的落点——强调色不参与分层，实心块只留给主操作。
 */
const buttonVariants = cva(
  "[&_svg]:-mx-0.5 relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-base outline-none transition-[box-shadow,transform] duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 active:scale-[0.97] sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-9 px-2.5 sm:h-8',
        icon: 'size-9 sm:size-8',
        'icon-lg': 'size-10 sm:size-9',
        'icon-sm': 'size-8 sm:size-7',
        'icon-xs': "size-7 rounded-md sm:size-6 [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-10 px-3 sm:h-9',
        sm: 'h-8 gap-1.5 px-2 sm:h-7',
        xl: "h-11 px-3.5 text-lg sm:h-10 sm:text-base [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        xs: "h-7 gap-1 rounded-md px-1.5 text-sm sm:h-6 sm:text-xs [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
      },
      variant: {
        default: 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90',
        'destructive-outline':
          'border-border bg-transparent text-destructive hover:border-destructive/32 hover:bg-destructive/8',
        ghost: 'border-transparent hover:bg-accent hover:text-accent-foreground',
        link: 'border-transparent underline-offset-4 hover:underline',
        // hover 用满不透明度：亮色下 --accent 是 zin-100 那一档，
        // 再打一半 alpha 压在白底上就看不见了
        outline: 'border-border bg-transparent hover:bg-accent',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90',
      },
    },
  },
);

interface ButtonProps extends useRender.ComponentProps<'button'> {
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
}

function Button({ className, variant, size, render, ...props }: ButtonProps) {
  // 用 render 换成别的标签（比如链接）时不写死 type，
  // 否则 <a type="button"> 这种非法属性会漏到 DOM 上
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>['type'] = render ? undefined : 'button';

  const defaultProps = {
    className: cn(buttonVariants({ className, size, variant })),
    'data-slot': 'button',
    type: typeValue,
  };

  return useRender({
    defaultTagName: 'button',
    props: mergeProps<'button'>(defaultProps, props),
    render,
  });
}

export { Button, buttonVariants };
