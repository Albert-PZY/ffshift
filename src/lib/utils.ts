import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并类名。
 *
 * clsx 处理条件，tailwind-merge 处理冲突——不合并的话
 * `cn('px-2', props.className)` 里传进来的 `px-4` 会被先写的赢掉，
 * 组件就失去了"可被外部覆盖"的能力。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
