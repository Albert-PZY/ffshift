import { Input as InputPrimitive } from '@base-ui/react/input';
import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * 输入框。
 *
 * 上游把外层 <span> 当边框容器、内层 input 只负责文字，好处是
 * 「有焦点 / 有错 / 有禁用」这些状态可以整体作用于边框而不只是输入框本身。
 * 这里保留同一结构，去掉上游的 Field/Form 包装（本项目没有表单上下文）。
 *
 * 底色分主题：亮色下就是面板白，靠 1px 边框划出边界；暗色下比面板亮一点点，
 * 来源是 border 色的 32% 叠加，不是另一个色值。
 */
type InputProps = Omit<InputPrimitive.Props & React.RefAttributes<HTMLInputElement>, 'size'> & {
  size?: 'sm' | 'default' | 'lg';
};

function Input({ className, size = 'default', ...props }: InputProps) {
  return (
    <span
      className={cn(
        'relative inline-flex w-full rounded-lg border border-input bg-background text-base text-foreground shadow-xs ring-ring/24 transition-shadow has-focus-visible:border-ring has-focus-visible:ring-[3px] has-aria-invalid:border-destructive/36 has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-disabled:opacity-64 sm:text-sm dark:bg-input/32',
        className,
      )}
      data-size={size}
      data-slot="input-control"
    >
      <InputPrimitive
        className={cn(
          'h-8.5 w-full min-w-0 rounded-[inherit] px-2.5 leading-8.5 outline-none placeholder:text-muted-foreground/72 sm:h-7.5 sm:leading-7.5',
          size === 'sm' && 'h-7.5 px-2 leading-7.5 sm:h-6.5 sm:leading-6.5',
          size === 'lg' && 'h-9.5 leading-9.5 sm:h-8.5 sm:leading-8.5',
          props.type === 'search' &&
            '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
        )}
        data-slot="input"
        {...props}
      />
    </span>
  );
}

export { Input, type InputProps };
