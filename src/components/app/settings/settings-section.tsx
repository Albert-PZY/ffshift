import { cn } from '@/lib/utils';

/**
 * 设置页里的一节。
 *
 * 每节是"标题 + 一句说明 + 若干行"。说明写"这一节管什么、留空会怎样"，
 * 不写"点击这里可以…"——设置项本身就该自解释。
 */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('mb-8 last:mb-0', className)} data-slot="settings-section">
      <h2 className="text-sm font-medium">{title}</h2>
      {description && <p className="mt-1 text-xs/relaxed text-muted-foreground">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * 设置里的一行：左边是名字与说明，右边是控件。
 *
 * 用左右分栏而不是上下堆叠：设置项的名字通常很短，堆叠会让人一眼扫不到重点，
 * 而且右边对齐之后，"哪些项现在是开着的"一眼能看出来。
 * 需要宽控件（路径、参数网格）的行直接用 `SettingsBlock`。
 */
export function SettingsRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-6 border-b border-border/60 py-3.5 last:border-b-0"
      data-slot="settings-row"
    >
      <div className="min-w-0">
        <label className="text-sm" htmlFor={htmlFor}>
          {label}
        </label>
        {hint && <p className="mt-0.5 text-xs/relaxed text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

/** 整块内容的行：控件自己占满一行，用于参数网格、预设列表这类放不进右栏的东西 */
export function SettingsBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/60 py-3.5 last:border-b-0" data-slot="settings-block">
      <p className="text-sm">{label}</p>
      {hint && <p className="mt-0.5 text-xs/relaxed text-muted-foreground">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </div>
  );
}
