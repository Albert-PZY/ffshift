import { Copy, Minus, Moon, PanelLeftClose, PanelLeftOpen, Square, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';
import type { Theme } from '@/lib/settings';
import { otherTheme, themeLabel } from '@/lib/theme';
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
 */
const DRAG = 'drag-region';
const NO_DRAG = 'no-drag';

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
              'flex h-full w-12 items-center justify-center text-muted-foreground transition-colors hover:text-foreground',
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
  railOpen,
  onToggleRail,
  theme,
  onToggleTheme,
  engineLabel,
  engineReady,
  versionLabel,
  versionTitle,
}: {
  railOpen: boolean;
  onToggleRail: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  engineLabel: string;
  engineReady: boolean;
  versionLabel: string;
  versionTitle: string;
}) {
  const maximized = useMaximized();
  const frame = window.ffshift?.frame;

  return (
    <header className={cn(DRAG, 'flex h-[44px] shrink-0 items-center border-b bg-background pl-2')}>
      <button
        type="button"
        aria-label={railOpen ? '收起设置栏' : '展开设置栏'}
        className={cn(
          NO_DRAG,
          't-icon-swap flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        )}
        data-state={railOpen ? 'a' : 'b'}
        onClick={onToggleRail}
      >
        <PanelLeftClose className="t-icon h-4 w-4" data-icon="a" />
        <PanelLeftOpen className="t-icon h-4 w-4" data-icon="b" />
      </button>

      <span className="ml-2 flex items-center gap-2">
        <span className="grid size-5 place-items-center rounded-[5px] bg-primary text-[10px] font-bold text-primary-foreground">
          F
        </span>
        <span className="text-sm font-medium">FFShift</span>
      </span>

      <Separator className={cn(NO_DRAG, 'mx-3 h-3.5 w-px')} orientation="vertical" />

      <span className={cn(NO_DRAG, 'truncate text-sm text-muted-foreground')}>ffmpeg 的换挡键</span>

      {/* 主题切换贴在窗口控制左边：它跟最大化、关闭一样是"整个窗口"的开关，
          不属于右边那组只读的运行环境信息 */}
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

        <Tooltip>
          <TooltipTrigger render={<span className="shrink-0 font-mono">{versionLabel}</span>} />
          <TooltipPopup className="max-w-lg" side="bottom">
            {versionTitle}
          </TooltipPopup>
        </Tooltip>
      </div>

      <div className={cn(NO_DRAG, 'flex items-center gap-0.5 pr-1')}>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={`切换到${themeLabel(otherTheme(theme))}主题`}
                className="t-icon-swap flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                data-state={theme === 'light' ? 'a' : 'b'}
                onClick={onToggleTheme}
              />
            }
          >
            {/* 图标表示"点下去会变成什么"，和收起/展开那对图标一个规矩 */}
            <Moon className="t-icon h-4 w-4" data-icon="a" />
            <Sun className="t-icon h-4 w-4" data-icon="b" />
          </TooltipTrigger>
          <TooltipPopup side="bottom">当前是{themeLabel(theme)}主题，点一下换成{themeLabel(otherTheme(theme))}</TooltipPopup>
        </Tooltip>
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
