import { Loader2Icon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** 转圈。用 lucide 的 Loader2 转起来，比手画 SVG 少一套要维护的路径 */
function Spinner({ className, ...props }: React.ComponentProps<typeof Loader2Icon>) {
  return <Loader2Icon aria-label="加载中" className={cn('animate-spin', className)} role="status" {...props} />;
}

export { Spinner };
