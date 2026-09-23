import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';
import type * as React from 'react';
import { Z_INDEX } from '@/lib/z-index';
import { cn } from '@/lib/utils';

/**
 * 对话框。
 *
 * 底板是 `bg-popover`（在暗色里与窗口同色），层级靠三样东西拉开：
 * `bg-black/32` + `backdrop-blur-sm` 的遮罩、`border` 的 1px 描边、
 * `shadow-lg` 的软阴影。这是本设计语言"分层不靠色块"的直接体现。
 */
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

function DialogBackdrop({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        'no-drag fixed inset-0 bg-black/32 backdrop-blur-sm transition-opacity duration-150 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0',
        className,
      )}
      data-slot="dialog-backdrop"
      style={{ zIndex: Z_INDEX.MODAL_BACKDROP }}
      {...props}
    />
  );
}

function DialogViewport({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('pointer-events-none fixed inset-0 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4', className)}
      data-slot="dialog-viewport"
      style={{ zIndex: Z_INDEX.MODAL_CONTENT }}
      {...props}
    />
  );
}

function DialogPopup({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <DialogViewport>
        <DialogPrimitive.Popup
          className={cn(
            'no-drag pointer-events-auto relative row-start-2 flex max-h-full min-h-0 w-full min-w-0 max-w-lg flex-col rounded-2xl border bg-popover text-popover-foreground shadow-lg transition-[scale,opacity] duration-150 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0',
            className,
          )}
          data-slot="dialog-popup"
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close
              aria-label="关闭"
              className="absolute end-3 top-2.5 z-50 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              <XIcon className="h-4 w-4" />
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Popup>
      </DialogViewport>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-2 p-6 pb-3', className)} data-slot="dialog-header" {...props} />;
}

function DialogFooter({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & { variant?: 'default' | 'bare' }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 px-6 sm:flex-row sm:items-center',
        variant === 'default' && 'rounded-b-[calc(var(--radius-2xl)-1px)] border-t bg-muted/50 py-4',
        variant === 'bare' && 'pt-3 pb-6',
        className,
      )}
      data-slot="dialog-footer"
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn('text-xl leading-none font-semibold', className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      data-slot="dialog-description"
      {...props}
    />
  );
}

/** 对话框主体：唯一可滚动的区域，头尾固定 */
function DialogPanel({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 pb-6', className)} data-slot="dialog-panel" {...props} />;
}

export {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  DialogViewport,
};
