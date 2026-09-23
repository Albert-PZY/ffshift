import { Upload } from 'lucide-react';
import { TaskRow } from '@/components/app/task-row';
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import type { TaskItem } from '@/store';

/**
 * 队列：投放条 + 任务行。
 *
 * 空的时候不留白：给一句话说明"该干什么"，而不是画一张插画。
 * 投放条常驻在列表上方，鼠标在窗口里任何位置都能点到它。
 */
export function QueueList({
  tasks,
  selectedId,
  dragging,
  onSelect,
  onPick,
}: {
  tasks: TaskItem[];
  selectedId: string | null;
  dragging: boolean;
  onSelect: (id: string) => void;
  onPick: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col gap-2 p-3">
      <button
        className={`flex h-9 w-full shrink-0 items-center gap-2 rounded-lg border border-dashed px-3 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground ${
          dragging ? 'border-ring bg-muted/30 text-foreground' : ''
        }`}
        data-slot="dropzone"
        type="button"
        onClick={onPick}
      >
        <Upload className="size-4 shrink-0" />
        <span>拖入视频，或点击添加</span>
        <span className="ml-auto text-xs text-muted-foreground">支持 MP4、MOV、MKV、WebM、AVI</span>
      </button>

      {tasks.length === 0 ? (
        <Empty className="border">
          <EmptyContent>
            <EmptyTitle>把视频拖进来</EmptyTitle>
            <EmptyDescription>或者点上面的投放条选文件。支持 mp4、mov、mkv、avi、webm 等常见格式。</EmptyDescription>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-0.5">
          {tasks.map((task) => (
            <TaskRow key={task.id} onSelect={() => onSelect(task.id)} selected={selectedId === task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
