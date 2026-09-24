import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * 勾选框。
 *
 * 方形的理由与圆形状态点一样：形状表达稳定含义（圆 = 状态，方 = 可勾）。
 * 尺寸跟着字号走（`size-3.5` 是 rem），所以在 24px 字号下也还是同一比例。
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-input bg-field transition-colors outline-none',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24',
        'data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground',
        'data-disabled:cursor-not-allowed data-disabled:opacity-64',
        className,
      )}
      data-slot="checkbox"
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center" data-slot="checkbox-indicator">
        <Check className="size-2.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
