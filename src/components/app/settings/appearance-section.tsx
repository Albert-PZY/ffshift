import { SettingsRow, SettingsSection } from '@/components/app/settings/settings-section';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import type { Theme } from '@/lib/settings';
import { useStore } from '@/store';

/**
 * 外观：主题。
 *
 * 从标题栏搬进来的——它是偏好，不是"这次要转成什么"。
 * 用分段切换而不是两个单选：两个互斥选项、一眼看到当前是哪个，就是这个控件的形状。
 */
export function AppearanceSection() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  return (
    <SettingsSection description="界面配色。选过之后记住，下次启动直接是这一套。" title="外观">
      <SettingsRow hint="亮色是默认。切换立即生效，不用重启。" label="主题">
        <Tabs className="gap-0" onValueChange={(value) => setTheme(value as Theme)} value={theme}>
          <TabsList>
            <TabsTab data-slot="theme-option" value="light">
              亮色
            </TabsTab>
            <TabsTab data-slot="theme-option" value="dark">
              暗色
            </TabsTab>
          </TabsList>
        </Tabs>
      </SettingsRow>
    </SettingsSection>
  );
}
