import { Check, Copy, FolderOpen, X } from 'lucide-react';
import { useState } from 'react';
import { IconButton } from '@/components/app/icon-button';
import { SectionLabel } from '@/components/app/section-label';
import { StatusBadge } from '@/components/app/status-badge';
import { Button } from '@/components/ui/button';
import { formatBytes, formatDuration, formatSizeChange } from '@/lib/format';
import { statusLabel } from '@/lib/task-status';
import type { TaskItem } from '@/store';

/** 一行字段：名字在左、值在右。值缺失时给占位符，不显示 NaN 也不留空 */
function Field({ name, value }: { name: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1" data-slot="field">
      <dt className="shrink-0 text-xs text-muted-foreground">{name}</dt>
      <dd
        className={`truncate text-right font-mono text-xs tabular-nums ${value ? '' : 'text-muted-foreground'}`}
        title={value ?? undefined}
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}

/**
 * 右侧详情栏。
 *
 * 只放真实的字段：读不出来的显示占位符，读到什么显示什么。
 * 原始日志默认折叠——它 99% 的时候是噪音，但那 1% 的时候是唯一能拿去问人的东西。
 */
export function Inspector({ task, onClose }: { task: TaskItem; onClose: () => void }) {
  const info = task.info;
  const [copied, setCopied] = useState(false);

  const copyLog = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板不可用就算了，不该为这个打断用户 */
    }
  };

  return (
    <aside
      className="flex w-[300px] shrink-0 flex-col overflow-hidden border-l bg-background"
      data-slot="inspector"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={task.path}>
            {task.name}
          </p>
          <StatusBadge className="mt-0.5" status={task.status} />
        </div>
        <IconButton label="收起详情" onActivate={onClose} size="md">
          <X className="h-4 w-4" />
        </IconButton>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <div className="grid aspect-video w-full place-items-center overflow-hidden rounded-md border bg-muted/30">
          {task.thumbnail ? (
            <img alt="" className="h-full w-full object-cover" src={task.thumbnail} />
          ) : (
            <span className="text-xs text-muted-foreground">无预览</span>
          )}
        </div>

        {task.reason && (
          <p
            className="rounded-md border border-destructive/32 bg-destructive/8 px-2.5 py-2 text-xs/relaxed"
            data-slot="reason"
          >
            {task.reason}
          </p>
        )}

        {task.failCount >= 2 && (
          <p className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 text-xs/relaxed" data-slot="reason">
            已连续失败 {task.failCount} 次，多半是文件本身的问题。处理完之后点行内的「重试」。
          </p>
        )}

        {task.errorRaw && (
          <details className="overflow-hidden rounded-md border" data-slot="raw-log">
            <summary className="cursor-pointer px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
              查看原始日志
            </summary>
            <pre className="select-text max-h-56 overflow-auto border-t p-2.5 font-mono text-metric/relaxed break-all whitespace-pre-wrap text-muted-foreground">
              {task.errorRaw}
            </pre>
            <div className="border-t p-1.5">
              <Button className="w-full" onClick={() => void copyLog(task.errorRaw ?? '')} size="sm" variant="ghost">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? '已复制' : '复制日志'}
              </Button>
            </div>
          </details>
        )}

        <section>
          <SectionLabel className="mb-1">媒体信息</SectionLabel>
          <dl>
            <Field name="时长" value={info?.durationSec != null ? formatDuration(info.durationSec) : null} />
            <Field name="分辨率" value={info?.width ? `${info.width} × ${info.height ?? '?'}` : null} />
            <Field name="帧率" value={info?.fps ? `${info.fps} fps` : null} />
            <Field name="视频编码" value={info?.videoCodec ?? null} />
            <Field name="音频编码" value={info?.audioCodec ?? null} />
            <Field name="声道" value={info?.channels != null ? String(info.channels) : null} />
            <Field name="容器" value={info?.container ?? null} />
            <Field name="码率" value={info?.bitrateKbps != null ? `${info.bitrateKbps} kbps` : null} />
            <Field name="像素格式" value={info?.pixelFormat ?? null} />
            <Field name="体积" value={task.sizeBytes ? formatBytes(task.sizeBytes) : null} />
          </dl>
        </section>

        <section>
          <SectionLabel className="mb-1">处理</SectionLabel>
          <dl>
            <Field name="状态" value={statusLabel(task.status)} />
            <Field
              name="体积变化"
              value={formatSizeChange(task.sizeBytes, task.outcome?.status === 'done' ? task.outcome.outputSizeBytes : null)}
            />
            <Field name="输出文件" value={task.output ? (task.output.split(/[\\/]/).pop() ?? null) : null} />
            <Field name="失败次数" value={task.failCount > 0 ? String(task.failCount) : null} />
          </dl>
        </section>
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t p-2">
        <Button
          className="flex-1"
          disabled={!task.output}
          onClick={() => void window.ffshift?.revealOutput(task.output ?? '')}
          size="sm"
          variant="outline"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          打开输出目录
        </Button>
      </footer>
    </aside>
  );
}
