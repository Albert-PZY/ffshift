import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import { Z_INDEX } from '@/lib/z-index';
import { cn } from '@/lib/utils';

/**
 * 对话框。
 *
 * 弹层分两层：遮罩压住底下的一切（`bg-background/60` + 模糊），
 * 面板走 `bg-popover` + 1px 描边 + `shadow-lg`——和下拉、提示气泡同一套表面规则，
 * 面板之间只有 1px 边框，颜色不参与分层（见 docs/design-system.md）。
 *
 * 入场是 150ms 的缩放回弹，退场更快：关的时候要马上消失，留白反而像卡住。
 */
const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogPopup({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className="fixed inset-0 bg-background/60 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
        data-slot="dialog-backdrop"
        style={{ zIndex: Z_INDEX.OVERLAY }}
      />
      <DialogPrimitive.Popup
        className={cn(
          'fixed top-1/2 left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none',
          'transition-[transform,opacity] duration-150 data-ending-style:scale-96 data-ending-style:opacity-0 data-starting-style:scale-96 data-starting-style:opacity-0',
          className,
        )}
        data-slot="dialog-popup"
        style={{ zIndex: Z_INDEX.OVERLAY + 1 }}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title className={cn('text-sm font-medium', className)} data-slot="dialog-title" {...props} />;
}

function DialogDescription({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <DialogPrimitive.Description
      className={cn('mt-2 text-xs leading-relaxed text-muted-foreground', className)}
      data-slot="dialog-description"
    >
      {children}
    </DialogPrimitive.Description>
  );
}

/** 按钮行：靠右，主按钮在最右 */
function DialogFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('mt-4 flex items-center justify-end gap-2', className)} data-slot="dialog-footer">
      {children}
    </div>
  );
}

export { Dialog, DialogClose, DialogDescription, DialogFooter, DialogPopup, DialogTitle, DialogTrigger };
