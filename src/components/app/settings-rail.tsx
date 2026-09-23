import { Eraser, FolderInput, FolderOpen, Plus, SlidersHorizontal } from 'lucide-react';
import { SectionLabel } from '@/components/app/section-label';
import { SelectField } from '@/components/app/select-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QUALITY_TIERS } from '@/lib/quality-tiers';
import { FORMAT_OPTIONS } from '@/lib/output-formats';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

/**
 * 左侧设置栏。
 *
 * 上面是"这次要用什么参数"，下面是"文件从哪来、往哪去"。
 * 底部那组是列表行形态（透明底 + hover 才亮），不是一排描边按钮——
 * 描边按钮一多，界面就会出现五六个看起来同等重要的入口。
 */
function RailRow({
  label,
  onActivate,
  danger = false,
  children,
}: {
  label: string;
  onActivate: () => void;
  danger?: boolean;
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

export function SettingsRail({ onOpenAdvanced }: { onOpenAdvanced: () => void }) {
  const preset = useStore((s) => s.preset);
  const outputFormat = useStore((s) => s.outputFormat);
  const outputDir = useStore((s) => s.outputDir);
  const targetSizeMiB = useStore((s) => s.targetSizeMiB);
  const setPreset = useStore((s) => s.setPreset);
  const setOutputFormat = useStore((s) => s.setOutputFormat);
  const setTargetSize = useStore((s) => s.setTargetSize);
  const pickOutputDir = useStore((s) => s.pickOutputDir);
  const clearOutputDir = useStore((s) => s.clearOutputDir);
  const addFolder = useStore((s) => s.addFolder);
  const clearFinished = useStore((s) => s.clearFinished);

  const pickFiles = async () => {
    const paths = await window.ffshift?.pickFiles();
    if (paths?.length) await useStore.getState().addFiles(paths);
  };

  const dirName = outputDir ? (outputDir.split(/[\\/]/).pop() ?? outputDir) : null;

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
            <Label className="text-xs text-muted-foreground" htmlFor="output-dir">
              输出目录
            </Label>
            {/* 长得像输入框，点开的是系统目录选择框 */}
            <button
              className="flex h-8 w-full items-center gap-2 overflow-hidden rounded-lg border border-input bg-background px-2.5 text-sm text-foreground shadow-xs transition-shadow hover:border-ring sm:h-7.5 dark:bg-input/32"
              data-slot="path-button"
              id="output-dir"
              title={outputDir ?? '与源文件同目录'}
              type="button"
              onClick={() => void pickOutputDir()}
            >
              <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{dirName ?? '与源文件同目录'}</span>
            </button>
            {outputDir && (
              <button
                className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                type="button"
                onClick={clearOutputDir}
              >
                恢复默认目录
              </button>
            )}
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
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              留空就按档位走恒定质量；填了就按目标体积反推码率。它是这一批的临时设置，不记忆。
            </p>
          </div>
        </section>
      </div>

      <div className="shrink-0 space-y-0.5 border-t p-2" data-slot="rail-actions">
        <RailRow label="专业参数" onActivate={onOpenAdvanced}>
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
