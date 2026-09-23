import { RefreshCw } from 'lucide-react';
import { SettingsBlock, SettingsRow, SettingsSection } from '@/components/app/settings/settings-section';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store';

/**
 * 关于：转换用的引擎是什么状态。
 *
 * 这些原来挤在标题栏里，两串文字占掉半个顶栏，而且都是只读信息——
 * 看一眼就没别的事可做。搬到设置页之后要查还是能查，主界面则只剩一个圆点加一句短标签。
 */
export function AboutSection() {
  const ffmpegVersion = useStore((s) => s.ffmpegVersion);
  const hardware = useStore((s) => s.hardware);
  const detectHardware = useStore((s) => s.detectHardware);

  return (
    <SettingsSection description="转换引擎的状态。硬件加速会自动启用，不需要手动选。" title="关于">
      <SettingsRow label="应用版本">
        <span className="font-mono text-xs tabular-nums">{import.meta.env.VITE_APP_VERSION}</span>
      </SettingsRow>

      {/* 用整宽的行：这串东西有六十多个字符，塞进右栏只能截断，那就失去了"完整版本号在这"的意义 */}
      <SettingsBlock hint="识别不出时说明没找到可用的 ffmpeg，转换会失败。" label="ffmpeg 版本">
        <p className="font-mono text-xs break-all text-muted-foreground">{ffmpegVersion ?? '未检测到 ffmpeg'}</p>
      </SettingsBlock>

      <SettingsRow hint="逐个试编码 1 秒，退出码为 0 才算可用，所以这里显示的都是真的能用的。" label="硬件加速">
        <span className="font-mono text-xs">{hardware.length > 0 ? hardware.join(' / ') : '不可用，用 CPU 编码'}</span>
        <Button onClick={() => void detectHardware()} size="sm" variant="ghost">
          <RefreshCw className="h-3.5 w-3.5" />
          重新检测
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}
