import { SelectField } from '@/components/app/select-field';
import { SettingsRow, SettingsSection } from '@/components/app/settings/settings-section';
import type { CloseAction } from '@/lib/settings';
import { useStore } from '@/store';

const OPTIONS: ReadonlyArray<{ value: CloseAction; label: string }> = [
  { value: 'ask', label: '每次询问' },
  { value: 'tray', label: '最小化到托盘' },
  { value: 'quit', label: '直接退出' },
];

/**
 * 常规：跟"转换什么"和"长什么样"都无关，但一直在起作用的行为。
 *
 * 关窗口这一项平时由确认框里的"记住我的选择"顺手设掉，这里只是回头改的地方——
 * 勾过一次之后就没有入口再问它了。
 */
export function GeneralSection() {
  const closeAction = useStore((s) => s.closeAction);
  const setCloseAction = useStore((s) => s.setCloseAction);

  return (
    <SettingsSection title="常规">
      <SettingsRow hint="最小化到托盘不会打断正在进行的转换。" label="关闭窗口时">
        <SelectField
          ariaLabel="关闭窗口时"
          className="w-36"
          onChange={(value) => setCloseAction(value as CloseAction)}
          options={OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
          value={closeAction}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
