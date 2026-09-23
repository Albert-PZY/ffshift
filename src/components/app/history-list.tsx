import { HistoryRow } from '@/components/app/history-row';
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import type { HistoryEntry } from '@/lib/settings';

/** 历史：完成的记、失败的也记——用户要能回看哪些文件没成 */
export function HistoryList({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="flex min-h-full flex-col p-3">
        <Empty className="border">
          <EmptyContent>
            <EmptyTitle>还没有转换记录</EmptyTitle>
            <EmptyDescription>完成的转换会记在这里，失败的也记。</EmptyDescription>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col gap-0.5 p-3">
      {history.map((entry) => (
        <HistoryRow entry={entry} key={entry.id} />
      ))}
    </div>
  );
}
