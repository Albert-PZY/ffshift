import { RefreshCw } from 'lucide-react';
import { SettingsBlock, SettingsRow, SettingsSection } from '@/components/app/settings/settings-section';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';

/** 关于：转换用的引擎状态。只读信息，从标题栏搬进来；检测动作是这一节唯一的操作。 */
export function AboutSection() {
  const ffmpegVersion = useStore((s) => s.ffmpegVersion);
  const hardware = useStore((s) => s.hardware);
  const detectHardware = useStore((s) => s.detectHardware);

  return (
    <SettingsSection title="关于">
      <SettingsRow label="应用版本">
        <span className="font-mono text-xs tabular-nums">{import.meta.env.VITE_APP_VERSION}</span>
      </SettingsRow>

      {/* 用整宽的行：这串东西有六十多个字符，塞进右栏只能截断，那就失去了"完整版本号在这"的意义 */}
      <SettingsBlock label="ffmpeg 版本">
        <p className="font-mono text-xs break-all text-muted-foreground">{ffmpegVersion ?? '未检测到 ffmpeg'}</p>
      </SettingsBlock>

      <SettingsRow label="硬件加速">
        <span className="font-mono text-xs">{hardware.length > 0 ? hardware.join(' / ') : '不可用，用 CPU 编码'}</span>
      </SettingsRow>

      <SettingsRow label="重新检测硬件加速">
        <Button onClick={() => void detectHardware()} size="sm" variant="outline">
          <RefreshCw className="h-3.5 w-3.5" />
          重新检测
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}
