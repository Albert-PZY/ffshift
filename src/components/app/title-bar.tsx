import { ArrowLeft, Copy, Minus, PanelLeftClose, PanelLeftOpen, Settings, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * 自绘标题栏。
 *
 * 窗口是无边框的（electron/main.ts 的 `frame: false`），所以整条 44px 的横条
 * 都是拖拽区（`.drag-region`），里面每个可点的东西必须自己挂 `.no-drag`——
 * 漏一个，那个按钮就变成"拖窗口"。
 *
 * 高度写死 44px 而不是 rem：窗口控制的命中区要跟系统一致，
 * 不能随根字号（14px）一起缩放。
 *
 * 页面上分两种形态：转换界面显示品牌 + 运行状态 + 设置入口；
 * 设置界面只留一个返回。标题栏是全局的，设置页也得能拖窗口、能关。
 */
const DRAG = 'drag-region';
const NO_DRAG = 'no-drag';

/** 图标按钮的统一样子：方形 + 圆角 md + 次要色，hover 才亮 */
const ICON_BUTTON =
  'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground';

/** 最大化状态：主进程是唯一权威，这里只做镜像；窗口 resize 时重新问一次 */
function useMaximized(): boolean {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const frame = window.ffshift?.frame;
    if (!frame) return;

    const sync = () => void frame.isMaximized().then(setMaximized);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  return maximized;
}

function FrameButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            className={cn(
              NO_DRAG,
              // 窗口控制按钮的宽度写死像素：它要和系统一致，不能随根字号缩放
              'flex h-full w-[48px] items-center justify-center text-muted-foreground transition-colors hover:text-foreground',
              danger ? 'hover:bg-destructive hover:text-destructive-foreground' : 'hover:bg-accent',
            )}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipPopup side="bottom">{label}</TooltipPopup>
    </Tooltip>
  );
}

export function TitleBar({
  settingsOpen,
  railOpen,
  onToggleRail,
  onOpenSettings,
  onCloseSettings,
  engineLabel,
  engineReady,
}: {
  settingsOpen: boolean;
  railOpen: boolean;
  onToggleRail: () => void;
  onOpenSettings: () => void;
  onCloseSettings: () => void;
  engineLabel: string;
  engineReady: boolean;
}) {
  const maximized = useMaximized();
  const frame = window.ffshift?.frame;

  return (
    <header className={cn(DRAG, 'flex h-[44px] shrink-0 items-center border-b bg-background pl-2')}>
      {settingsOpen ? (
        <>
          <button
            aria-label="返回转换界面"
            className={cn(NO_DRAG, ICON_BUTTON)}
            data-slot="settings-back"
            type="button"
            onClick={onCloseSettings}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="ml-2 text-sm font-medium">设置</span>
        </>
      ) : (
        <>
          <button
            aria-label={railOpen ? '收起设置栏' : '展开设置栏'}
            className={cn(NO_DRAG, ICON_BUTTON, 't-icon-swap')}
            data-state={railOpen ? 'a' : 'b'}
            type="button"
            onClick={onToggleRail}
          >
            <PanelLeftClose className="t-icon h-4 w-4" data-icon="a" />
            <PanelLeftOpen className="t-icon h-4 w-4" data-icon="b" />
          </button>

          <span className="ml-2 flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-[5px] bg-primary text-label font-bold text-primary-foreground">
              F
            </span>
            <span className="text-sm font-medium">FFShift</span>
          </span>

          <Separator className={cn(NO_DRAG, 'mx-3 h-3.5 w-px')} orientation="vertical" />

          <span className={cn(NO_DRAG, 'truncate text-sm text-muted-foreground')}>ffmpeg 的换挡键</span>
        </>
      )}

      {/* 运行环境是只读状态，悬停给解释；详细版本信息在设置的「关于」里 */}
      {!settingsOpen && (
        <div className={cn(NO_DRAG, 'ml-auto flex items-center gap-3 pr-2 text-xs text-muted-foreground')}>
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="flex items-center gap-1.5">
                  <i
                    aria-hidden="true"
                    className={cn('size-1.5 rounded-full', engineReady ? 'bg-success' : 'bg-muted-foreground')}
                  />
                  {engineLabel}
                </span>
              }
            />
            <TooltipPopup side="bottom">
              {engineReady ? '检测到可用的硬件编码器，转换会自动用它' : '没有可用硬件编码器，用 CPU 编码'}
            </TooltipPopup>
          </Tooltip>
        </div>
      )}

      <div className={cn(NO_DRAG, settingsOpen ? 'ml-auto pr-2' : 'flex items-center gap-0.5 pr-1')}>
        {!settingsOpen && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  aria-label="设置"
                  className={ICON_BUTTON}
                  data-slot="settings-button"
                  type="button"
                  onClick={onOpenSettings}
                />
              }
            >
              <Settings className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipPopup side="bottom">设置</TooltipPopup>
          </Tooltip>
        )}
      </div>

      <div className={cn(NO_DRAG, 'flex h-full items-center')}>
        <FrameButton label="最小化" onClick={() => frame?.minimize()}>
          <Minus className="h-4 w-4" />
        </FrameButton>
        <FrameButton label={maximized ? '还原' : '最大化'} onClick={() => frame?.toggleMaximize()}>
          {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </FrameButton>
        <FrameButton danger label="关闭" onClick={() => frame?.close()}>
          <X className="h-4 w-4" />
        </FrameButton>
      </div>
    </header>
  );
}
