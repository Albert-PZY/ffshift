import { PanelRightClose, PanelRightOpen, Play, Trash2 } from 'lucide-react';
import { HistoryList } from '@/components/app/history-list';
import { QueueList } from '@/components/app/queue-list';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { isActive } from '@/lib/task-status';
import { validateForFormat } from '@/lib/advanced-params';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

/**
 * 中间栏：队列 / 历史的切换、列表、以及底部那条动作与状态合一的横条。
 *
 * 底栏为什么只有一条：上游是「输入框」+「状态行」两条，因为它的主动作是"发消息"。
 * 本项目的主动作（开始转换）只作用于队列，单独占一行会空掉半行，
 * 所以合成一条——左边是机器给的数字，右边是唯一的主按钮。
 */
export function Workspace({
  dragging,
  inspectorOpen,
  selectedId,
  onSelect,
  onToggleInspector,
}: {
  dragging: boolean;
  inspectorOpen: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleInspector: () => void;
}) {
  const tasks = useStore((s) => s.tasks);
  const history = useStore((s) => s.history);
  const view = useStore((s) => s.view);
  const outputDir = useStore((s) => s.outputDir);
  const notice = useStore((s) => s.notice);
  const outputFormat = useStore((s) => s.outputFormat);
  const advanced = useStore((s) => s.advanced);
  const setView = useStore((s) => s.setView);
  const startAll = useStore((s) => s.startAll);
  const clearHistory = useStore((s) => s.clearHistory);

  const runnableCount = tasks.filter((task) => task.status === 'ready' || task.status === 'failed').length;
  const runningCount = tasks.filter((task) => task.status === 'running').length;
  const queuedCount = tasks.filter((task) => isActive(task.status)).length;

  // 专业参数有错就不让开始：设置页里那份表单在另一屏，用户看不到错误提示，
  // 唯一能拦住"带着非法参数去转换"的地方就是这里
  const paramsBroken = validateForFormat(advanced, outputFormat).errors.length > 0;

  const pickFiles = async () => {
    const paths = await window.ffshift?.pickFiles();
    if (paths?.length) await useStore.getState().addFiles(paths);
  };

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        {/* 标题就是这两个标签本身，不再另起一行「转换队列 / 转换历史」——
            同一件事说两遍只会让顶栏看起来更挤 */}
        <Tabs className="shrink-0 gap-0" onValueChange={(value) => setView(value as 'queue' | 'history')} value={view}>
          <TabsList>
            <TabsTab value="queue">队列</TabsTab>
            <TabsTab value="history">历史</TabsTab>
          </TabsList>
        </Tabs>

        {/* 条数截断、按钮不缩：字号大到这一行放不下时，宁可少显示几个字，
            也不能让它们各自压成一列一个字 */}
        <span className="min-w-0 truncate text-xs text-muted-foreground tabular-nums">
          {view === 'queue' ? `共 ${tasks.length} 个文件` : `${history.length} 条记录`}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {view === 'history' && history.length > 0 && (
            <Button onClick={clearHistory} size="sm" variant="ghost">
              <Trash2 className="h-3.5 w-3.5" />
              清空历史
            </Button>
          )}
          <Button
            aria-label={inspectorOpen ? '收起详情' : '打开详情'}
            onClick={onToggleInspector}
            size="sm"
            variant="ghost"
          >
            {inspectorOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            {inspectorOpen ? '收起详情' : '打开详情'}
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {view === 'queue' ? (
          <QueueList dragging={dragging} onPick={() => void pickFiles()} onSelect={onSelect} selectedId={selectedId} tasks={tasks} />
        ) : (
          <HistoryList history={history} />
        )}
      </div>

      <div
        className="flex shrink-0 items-center gap-2.5 border-t px-3 py-2 text-metric text-muted-foreground"
        data-slot="status-bar"
      >
        {/* 看历史时不再报队列的数：那两行数字属于队列，摆在历史下面会读错 */}
        {view === 'queue' ? (
          <>
            <i
              aria-hidden="true"
              className={cn('size-1.5 shrink-0 rounded-full', queuedCount > 0 ? 'animate-pulse bg-info' : 'bg-muted-foreground')}
            />
            <span className="min-w-0 truncate tabular-nums">
              {tasks.length === 0 ? '还没有文件' : `共 ${tasks.length} 个 · 待转换 ${runnableCount} 个`}
              {runningCount > 0 ? ` · 正在进行 ${runningCount} 个` : ''}
            </span>
          </>
        ) : (
          <span className="min-w-0 truncate tabular-nums">共 {history.length} 条记录</span>
        )}

        <Separator className="h-3 w-px shrink-0" orientation="vertical" />

        {paramsBroken ? (
          <span className="min-w-0 flex-1 truncate text-destructive">专业参数有误，去设置里改完再开始</span>
        ) : notice ? (
          // 一次性提示说明"刚刚那下为什么没生效"，优先级在输出位置之上：
          // 输出位置是常驻信息，提示错过就没了
          <span className="min-w-0 flex-1 truncate text-destructive" data-slot="notice" title={notice}>
            {notice}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate" title={outputDir ?? '与源文件同目录'}>
            {outputDir ? `输出到 ${outputDir}` : '输出到源文件同目录'}
          </span>
        )}

        <Button
          className="shrink-0"
          disabled={runnableCount === 0 || paramsBroken}
          onClick={() => void startAll()}
          size="default"
        >
          <Play className="h-3.5 w-3.5" />
          {runningCount > 0 ? '继续排队' : '开始转换'}
        </Button>
      </div>
    </section>
  );
}
