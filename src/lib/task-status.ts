/**
 * 任务状态与它的视觉归属。
 *
 * 抽成纯函数是因为这份对应关系同时被三处用：队列行、详情栏、历史记录。
 * 三处各写一遍的话，加一个状态就会漏掉一处——而"状态显示错"是最难被发现的 bug。
 *
 * 颜色只做辅助，文字必须同时表达（见 docs/design-system.md 的可访问性条款）。
 */
export type TaskStatus =
  | 'reading'
  | 'ready'
  | 'queued'
  | 'running'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'unsupported';

/** 语义色档位，对应主题里的 muted-foreground / info / success / warning / destructive */
export type TaskTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const LABEL: Record<TaskStatus, string> = {
  reading: '读取中',
  ready: '待转换',
  queued: '排队中',
  running: '转换中',
  done: '已完成',
  failed: '失败',
  cancelled: '已取消',
  unsupported: '不支持',
};

const TONE: Record<TaskStatus, TaskTone> = {
  reading: 'neutral',
  ready: 'neutral',
  queued: 'info',
  running: 'info',
  done: 'success',
  failed: 'danger',
  cancelled: 'warning',
  unsupported: 'danger',
};

/** 状态文字。界面上不出现英文与缩写，也不出现这八个词以外的说法 */
export function statusLabel(status: TaskStatus): string {
  return LABEL[status];
}

export function statusTone(status: TaskStatus): TaskTone {
  return TONE[status];
}

/** 该状态是否已经结束（结束的任务才允许移除） */
export function isFinished(status: TaskStatus): boolean {
  return status === 'done' || status === 'failed' || status === 'cancelled' || status === 'unsupported';
}

/** 该状态是否算"正在跑"，底栏与小圆点都看它 */
export function isActive(status: TaskStatus): boolean {
  return status === 'running' || status === 'queued';
}
