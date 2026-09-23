import { Upload } from 'lucide-react';
import { Z_INDEX } from '@/lib/z-index';

/**
 * 拖放提示：拖动文件进入时压住整个窗口。
 *
 * `pointer-events-none` 是必须的——它盖在所有东西上面，一旦能接事件，
 * 底下的拖放目标就永远收不到 drop，用户松手等于什么都没发生。
 */
export function DropOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-2 grid place-content-center justify-items-center gap-2 rounded-xl border-2 border-dashed border-ring bg-background/80 backdrop-blur-sm"
      data-slot="drop-overlay"
      style={{ zIndex: Z_INDEX.OVERLAY }}
    >
      <Upload className="size-5 text-muted-foreground" />
      <span className="text-sm">松开以添加视频</span>
    </div>
  );
}
