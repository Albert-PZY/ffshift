import { Eraser, FolderInput, Plus, SlidersHorizontal } from 'lucide-react';
import { SectionLabel } from '@/components/app/section-label';
import { SelectField } from '@/components/app/select-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { describeAdvanced, isAdvancedEmpty } from '@/lib/advanced-params';
import { QUALITY_TIERS } from '@/lib/quality-tiers';
import { FORMAT_OPTIONS } from '@/lib/output-formats';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

/**
 * 左侧设置栏：只放"这次要转成什么"。
 *
 * 输出目录、专业参数、主题这些"设置一次长期有效"的项都搬进了设置页（ADR-018），
 * 这里留下的三项——档位、输出格式、目标体积——都是每批文件都要重新决定的。
 * 底部那组是列表行形态（透明底 + hover 才亮），不是一排描边按钮——
 * 描边按钮一多，界面就会出现五六个看起来同等重要的入口。
 */
function RailRow({
  label,
  onActivate,
  danger = false,
  trailing,
  children,
}: {
  label: string;
  onActivate: () => void;
  danger?: boolean;
  /** 行尾的补充信息，比如专业参数改了几项 */
  trailing?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors',
        danger ? 'hover:bg-muted/70 hover:text-destructive' : 'hover:bg-muted/70 hover:text-foreground',
      )}
      type="button"
      onClick={onActivate}
    >
      {children}
      {label}
      {trailing && <span className="ml-auto text-label tabular-nums text-muted-foreground">{trailing}</span>}
    </button>
  );
}

/** 目标体积：空 → 不限；越界收敛到 1–10000，不把 NaN 或负数传下去 */
function readTargetSize(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 1) return null;
  return Math.round(Math.min(value, 10_000));
}

export function SettingsRail({ onOpenSettings }: { onOpenSettings: () => void }) {
  const preset = useStore((s) => s.preset);
  const outputFormat = useStore((s) => s.outputFormat);
  const targetSizeMiB = useStore((s) => s.targetSizeMiB);
  const advanced = useStore((s) => s.advanced);
  const setPreset = useStore((s) => s.setPreset);
  const setOutputFormat = useStore((s) => s.setOutputFormat);
  const setTargetSize = useStore((s) => s.setTargetSize);
  const addFolder = useStore((s) => s.addFolder);
  const clearFinished = useStore((s) => s.clearFinished);

  const pickFiles = async () => {
    const paths = await window.ffshift?.pickFiles();
    if (paths?.length) await useStore.getState().addFiles(paths);
  };

  // 改过专业参数就在行尾标出来：不然用户过两天会奇怪"怎么画质跟以前不一样"
  const customized = !isAdvancedEmpty(advanced);
  const overrideCount = describeAdvanced(advanced).length;

  return (
    <aside
      className="flex w-[264px] shrink-0 flex-col overflow-hidden border-r bg-background"
      data-slot="settings-rail"
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        <section className="space-y-2" data-slot="rail-section">
          <SectionLabel>转换设置</SectionLabel>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="preset-menu">
              质量档位
            </Label>
            <SelectField
              ariaLabel="质量档位"
              id="preset-menu"
              onChange={setPreset}
              options={QUALITY_TIERS.map((tier) => ({ value: tier.id, label: tier.label, note: tier.note }))}
              value={preset}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="format-menu">
              输出格式
            </Label>
            <SelectField
              ariaLabel="输出格式"
              id="format-menu"
              onChange={setOutputFormat}
              options={FORMAT_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
                note: `${option.group} · ${option.note}`,
              }))}
              value={outputFormat}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="target-size">
              目标体积（MiB）
            </Label>
            <Input
              id="target-size"
              max={10000}
              min={1}
              onChange={(event) => setTargetSize(readTargetSize(event.target.value))}
              placeholder="不限"
              type="number"
              value={targetSizeMiB ?? ''}
            />
            <p className="text-metric leading-relaxed text-muted-foreground">
              留空就按档位走恒定质量；填了就按目标体积反推码率。只对这一批生效，不记忆。
            </p>
          </div>
        </section>
      </div>

      <div className="shrink-0 space-y-0.5 border-t p-2" data-slot="rail-actions">
        <RailRow
          label="专业参数"
          onActivate={onOpenSettings}
          trailing={customized ? `${overrideCount} 项已自定义` : undefined}
        >
          <SlidersHorizontal className="size-4 shrink-0" />
        </RailRow>
        <RailRow label="添加视频" onActivate={() => void pickFiles()}>
          <Plus className="size-4 shrink-0" />
        </RailRow>
        <RailRow label="导入文件夹" onActivate={() => void addFolder()}>
          <FolderInput className="size-4 shrink-0" />
        </RailRow>
        <RailRow danger label="清空已完成" onActivate={clearFinished}>
          <Eraser className="size-4 shrink-0" />
        </RailRow>
      </div>
    </aside>
  );
}
