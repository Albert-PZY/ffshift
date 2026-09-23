import { AboutSection } from '@/components/app/settings/about-section';
import { AppearanceSection } from '@/components/app/settings/appearance-section';
import { OutputSection } from '@/components/app/settings/output-section';
import { ParamsSection } from '@/components/app/settings/params-section';
import { SectionLabel } from '@/components/app/section-label';
import { cn } from '@/lib/utils';

/** 设置页的分类。顺序按"改得最勤的排在最前" */
export const SETTINGS_CATEGORIES = [
  { id: 'output', label: '输出' },
  { id: 'params', label: '参数预设' },
  { id: 'appearance', label: '外观' },
  { id: 'about', label: '关于' },
] as const;

export type SettingsCategory = (typeof SETTINGS_CATEGORIES)[number]['id'];

/**
 * 设置页：左侧分类、右侧内容。
 *
 * 为什么整页切换而不是弹窗：这里的每一项都是"设置一次、长期有效"的偏好，
 * 参数预设那一节还有一屏多的表单——塞进对话框就得在里面再滚一遍，
 * 而且弹窗天生给人"临时改一下"的暗示。主界面腾出来的位置刚好留给转换本身。
 */
export function SettingsView({
  category,
  onCategoryChange,
}: {
  category: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1" data-slot="settings-view">
      <nav className="w-44 shrink-0 overflow-y-auto border-r p-2" data-slot="settings-nav">
        <SectionLabel className="px-2 pt-1 pb-2">设置</SectionLabel>
        {SETTINGS_CATEGORIES.map((item) => (
          <button
            className={cn(
              'flex h-7 w-full items-center rounded-md px-2 text-xs font-medium transition-colors',
              item.id === category
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            )}
            data-active={item.id === category ? 'true' : undefined}
            data-slot="settings-nav-item"
            key={item.id}
            type="button"
            onClick={() => onCategoryChange(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto" data-slot="settings-content">
        <div className="mx-auto max-w-3xl p-6">
          {category === 'output' && <OutputSection />}
          {category === 'params' && <ParamsSection />}
          {category === 'appearance' && <AppearanceSection />}
          {category === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  );
}
