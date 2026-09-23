import { SettingsRow, SettingsSection } from '@/components/app/settings/settings-section';
import { SelectField } from '@/components/app/select-field';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { derivedFontSizes, FONT_SIZE_OPTIONS } from '@/lib/font-scale';
import type { Theme } from '@/lib/settings';
import { themeLabel } from '@/lib/theme';
import { useStore } from '@/store';

/** 按明度从高到低排：亮色 → 浅黑 → 暗色。用户扫一眼就知道这三套是什么关系 */
const THEME_ORDER = ['light', 'dim', 'dark'] as const;

/**
 * 外观：主题与字号。
 *
 * 两项都是偏好，不是"这次要转成什么"，所以都在设置页里（ADR-018）。
 * 主题只有两个值，用分段切换；字号有 15 个值，用下拉——分段切换放 15 个就是一条状态栏。
 */
export function AppearanceSection() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const fontSize = useStore((s) => s.fontSize);
  const setFontSize = useStore((s) => s.setFontSize);

  const sizes = derivedFontSizes(fontSize);

  return (
    <SettingsSection description="界面配色与字号。选过之后记住，下次启动直接是这一套。" title="外观">
      <SettingsRow
        hint="亮色是默认。浅黑是偏灰的一套——底比暗色浅、文字不用纯白，长时间看没那么累。切换立即生效，不用重启。"
        label="主题"
      >
        <Tabs className="gap-0" onValueChange={(value) => setTheme(value as Theme)} value={theme}>
          <TabsList>
            {THEME_ORDER.map((value) => (
              <TabsTab data-slot="theme-option" key={value} value={value}>
                {themeLabel(value)}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>
      </SettingsRow>

      <SettingsRow
        hint="基准字号。全站的文字、间距、控件高度都按它等比缩放，所以调的是整体大小，不只是文字。窗口骨架（左右两栏宽度、标题栏高度）不跟着变。"
        label="字号"
      >
        <SelectField
          ariaLabel="字号"
          className="w-24"
          onChange={(value) => setFontSize(Number(value))}
          options={FONT_SIZE_OPTIONS.map((px) => ({ value: String(px), label: `${px}px` }))}
          value={String(fontSize)}
        />
      </SettingsRow>

      {/* 把派生出来的字号一起报出来：不然用户对着"基准 14px"猜正文到底多大 */}
      <p className="pt-3 text-xs text-muted-foreground tabular-nums" data-slot="font-size-preview">
        基准 {fontSize}px · 正文 {sizes.body}px · 元信息 {sizes.meta}px · 小节标题 {sizes.label}px
      </p>
    </SettingsSection>
  );
}
