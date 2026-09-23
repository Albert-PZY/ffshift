import { FolderOpen } from 'lucide-react';
import { SettingsRow, SettingsSection } from '@/components/app/settings/settings-section';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';

/**
 * 输出：产物默认存到哪里。
 *
 * 这一项从主界面搬进来的——它设置一次能用很久，属于偏好而不是"这次要转成什么"。
 * 主界面底栏仍然显示当前输出位置，所以搬走之后也不会有"东西去哪了"的问题。
 */
export function OutputSection() {
  const outputDir = useStore((s) => s.outputDir);
  const pickOutputDir = useStore((s) => s.pickOutputDir);
  const clearOutputDir = useStore((s) => s.clearOutputDir);

  return (
    <SettingsSection title="输出">
      <SettingsRow hint="留空则放在源文件旁边。" htmlFor="output-dir" label="默认输出目录">
        {/* 长得像输入框，点开的是系统目录选择框 */}
        <button
          className="flex h-8 w-56 items-center gap-2 overflow-hidden rounded-lg border border-input bg-field px-2.5 text-sm text-foreground shadow-xs transition-shadow hover:border-ring sm:h-7.5"
          data-slot="path-button"
          id="output-dir"
          title={outputDir ?? '与源文件同目录'}
          type="button"
          onClick={() => void pickOutputDir()}
        >
          <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{outputDir ? (outputDir.split(/[\\/]/).pop() ?? outputDir) : '与源文件同目录'}</span>
        </button>

        {outputDir && (
          <Button onClick={clearOutputDir} size="sm" variant="ghost">
            恢复默认
          </Button>
        )}
      </SettingsRow>
    </SettingsSection>
  );
}
