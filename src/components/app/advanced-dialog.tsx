import { X } from 'lucide-react';
import { useState } from 'react';
import { NumberParam, SelectParam, TextParam } from '@/components/app/param-field';
import { SectionLabel } from '@/components/app/section-label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter, DialogHeader, DialogPanel, DialogPopup, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  AUDIO_CODECS,
  ENCODER_PRESETS,
  PIXEL_FORMATS,
  PROFILES,
  SAMPLE_RATES,
  SCALE_ALGORITHMS,
  SCALE_PRESETS,
  TUNES,
  VIDEO_CODECS,
  validateAdvanced,
} from '@/lib/advanced-params';
import { resolveContainer } from '@/lib/ffmpeg-args';
import { BUILTIN_PRESETS } from '@/lib/presets';
import { useStore } from '@/store';

/**
 * 专业参数面板：给懂行的人一个入口。
 *
 * 三条原则（与重构前一致，实现换成了对话框原语）：
 *   - 「不干预」永远是个选项（字段为 null），所以只用档位时产出的命令与本面板存在之前一致；
 *   - 校验结果显示在底部，有错时不让关——不带着非法参数去转换；
 *   - 预设既能一键套用，也能把自己的组合存下来、导出给同事。
 */
export function AdvancedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const advanced = useStore((s) => s.advanced);
  const presets = useStore((s) => s.presets);
  const outputFormat = useStore((s) => s.outputFormat);
  const setAdvanced = useStore((s) => s.setAdvanced);
  const resetAdvanced = useStore((s) => s.resetAdvanced);
  const savePreset = useStore((s) => s.savePreset);
  const applyPreset = useStore((s) => s.applyPreset);
  const deletePreset = useStore((s) => s.deletePreset);
  const importPresetFile = useStore((s) => s.importPresetFile);
  const exportPresetFile = useStore((s) => s.exportPresetFile);

  const [name, setName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const container = resolveContainer(outputFormat, 'x.mkv');
  const { errors, warnings } = validateAdvanced(advanced, container);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogPopup className="max-w-[52rem]">
        <DialogHeader>
          <DialogTitle>专业参数</DialogTitle>
          <p className="text-sm text-muted-foreground">不填的项按档位走</p>
        </DialogHeader>

        <DialogPanel className="space-y-5">
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <SectionLabel>预设</SectionLabel>
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={async () => {
                    const result = await importPresetFile();
                    setNotice(
                      result.added > 0
                        ? `导入 ${result.added} 个预设${result.skipped > 0 ? `，跳过 ${result.skipped} 个` : ''}`
                        : '没有导入任何预设（文件为空、格式不对或名称重复）',
                    );
                  }}
                  size="sm"
                  variant="ghost"
                >
                  导入
                </Button>
                <Button disabled={presets.length === 0} onClick={() => void exportPresetFile()} size="sm" variant="ghost">
                  导出
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {BUILTIN_PRESETS.map((preset) => (
                <button
                  className="inline-flex h-6 items-center rounded-full border px-2.5 text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
                  data-owner="builtin"
                  data-slot="preset-chip"
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.name}
                </button>
              ))}

              {presets.map((preset) => (
                <span
                  className="inline-flex h-6 items-center gap-0.5 rounded-full border border-info/32 pr-0.5 pl-2.5 text-xs text-foreground"
                  data-owner="user"
                  data-slot="preset-chip"
                  key={preset.id}
                >
                  <button className="text-xs" type="button" onClick={() => applyPreset(preset)}>
                    {preset.name}
                  </button>
                  <button
                    aria-label={`删除预设 ${preset.name}`}
                    className="grid size-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent/50 hover:text-destructive"
                    type="button"
                    onClick={() => deletePreset(preset.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </section>

          <section className="space-y-2.5">
            <SectionLabel>视频编码</SectionLabel>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2.5">
              <SelectParam
                label="编码器"
                onChange={(next) => setAdvanced({ videoCodec: next })}
                options={VIDEO_CODECS.map((item) => ({ value: item.value as string, label: item.label }))}
                value={advanced.videoCodec}
              />
              <NumberParam
                label="CRF"
                onChange={(next) => setAdvanced({ crf: next })}
                placeholder="如 23"
                value={advanced.crf}
              />
              <NumberParam
                label="目标码率 kbps"
                onChange={(next) => setAdvanced({ videoBitrateKbps: next, rateControl: next === null ? null : 'bitrate' })}
                placeholder="如 4000"
                value={advanced.videoBitrateKbps}
              />
              <SelectParam
                label="编码速度"
                onChange={(next) => setAdvanced({ encoderPreset: next })}
                options={ENCODER_PRESETS.map((item) => ({ value: item as string, label: item }))}
                value={advanced.encoderPreset}
              />
              <SelectParam
                label="tune"
                onChange={(next) => setAdvanced({ tune: next })}
                options={TUNES.map((item) => ({ value: item as string, label: item }))}
                value={advanced.tune}
              />
              <SelectParam
                label="profile"
                onChange={(next) => setAdvanced({ profile: next })}
                options={PROFILES.map((item) => ({ value: item as string, label: item }))}
                value={advanced.profile}
              />
              <SelectParam
                label="像素格式"
                onChange={(next) => setAdvanced({ pixelFormat: next })}
                options={PIXEL_FORMATS.map((item) => ({ value: item as string, label: item }))}
                value={advanced.pixelFormat}
              />
              <NumberParam
                label="关键帧间隔"
                onChange={(next) => setAdvanced({ gop: next })}
                placeholder="如 60"
                value={advanced.gop}
              />
            </div>
          </section>

          <section className="space-y-2.5">
            <SectionLabel>画面</SectionLabel>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2.5">
              <SelectParam
                label="缩放"
                onChange={(next) => setAdvanced({ scale: next })}
                options={SCALE_PRESETS.map((item) => ({ value: item as string, label: item }))}
                value={advanced.scale}
              />
              <SelectParam<'bicubic' | 'lanczos' | 'neighbor' | 'bilinear'>
                label="缩放算法"
                onChange={(next) => setAdvanced({ scaleAlgorithm: next })}
                options={SCALE_ALGORITHMS.map((item) => ({ value: item, label: item }))}
                value={advanced.scaleAlgorithm}
              />
              <NumberParam label="帧率" onChange={(next) => setAdvanced({ fps: next })} placeholder="如 30" value={advanced.fps} />
            </div>
            <p className="text-xs text-muted-foreground">缩放也可以直接手填宽高，例如 1920x1080（不一定是上面那几档）</p>
          </section>

          <section className="space-y-2.5">
            <SectionLabel>音频</SectionLabel>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2.5">
              <SelectParam<'copy' | 'encode' | 'none'>
                label="处理方式"
                onChange={(next) => setAdvanced({ audioMode: next })}
                options={[
                  { value: 'encode', label: '重新编码' },
                  { value: 'copy', label: '保持原样' },
                  { value: 'none', label: '移除音轨' },
                ]}
                value={advanced.audioMode}
              />
              <SelectParam
                label="编码器"
                onChange={(next) => setAdvanced({ audioCodec: next })}
                options={AUDIO_CODECS.map((item) => ({ value: item.value as string, label: item.label }))}
                value={advanced.audioCodec}
              />
              <NumberParam
                label="码率 kbps"
                onChange={(next) => setAdvanced({ audioBitrateKbps: next })}
                placeholder="如 192"
                value={advanced.audioBitrateKbps}
              />
              <SelectParam
                label="采样率"
                onChange={(next) => setAdvanced({ sampleRate: next === null ? null : Number(next) })}
                options={SAMPLE_RATES.map((item) => ({ value: String(item), label: `${item} Hz` }))}
                value={advanced.sampleRate === null ? null : String(advanced.sampleRate)}
              />
              <SelectParam
                label="声道"
                onChange={(next) => setAdvanced({ channels: next === null ? null : (Number(next) as 1 | 2) })}
                options={[
                  { value: '1', label: '单声道' },
                  { value: '2', label: '立体声' },
                ]}
                value={advanced.channels === null ? null : String(advanced.channels)}
              />
            </div>
          </section>

          <section className="space-y-2.5">
            <SectionLabel>容器与性能</SectionLabel>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2.5">
              <SelectParam
                label="faststart"
                onChange={(next) => setAdvanced({ faststart: next === null ? null : next === 'true' })}
                options={[
                  { value: 'true', label: '开' },
                  { value: 'false', label: '关' },
                ]}
                value={advanced.faststart === null ? null : String(advanced.faststart)}
              />
              <NumberParam label="线程数" onChange={(next) => setAdvanced({ threads: next })} placeholder="自动" value={advanced.threads} />
              <TextParam
                label="额外参数"
                onChange={(next) => setAdvanced({ extraArgs: next })}
                placeholder="如 -movflags +faststart"
                value={advanced.extraArgs}
              />
            </div>
          </section>

          {errors.length > 0 && (
            // key 跟着错误内容变：同一个错误重复出现时也要再抖一次，否则用户以为没反应
            <div className="t-shake-in space-y-1" key={errors.join('|')} data-slot="validation">
              {errors.map((error) => (
                <p
                  className="rounded-md border border-destructive/32 bg-destructive/8 px-2.5 py-2 text-xs/relaxed"
                  data-slot="reason"
                  key={error}
                >
                  {error}
                </p>
              ))}
            </div>
          )}

          {(warnings.length > 0 || notice) && (
            <div className="space-y-1">
              {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
              {warnings.map((warning) => (
                <p className="text-xs text-muted-foreground" key={warning}>
                  {warning}
                </p>
              ))}
            </div>
          )}
        </DialogPanel>

        <DialogFooter>
          <Button onClick={resetAdvanced} size="sm" variant="ghost">
            全部重置
          </Button>
          <div className="flex flex-1 items-center gap-1.5">
            <Input
              onChange={(event) => setName(event.target.value)}
              placeholder="给这套参数起个名字"
              size="sm"
              value={name}
            />
            <Button
              disabled={name.trim().length === 0}
              onClick={() => {
                savePreset(name);
                setName('');
                setNotice('已存为预设');
              }}
              size="sm"
              variant="outline"
            >
              存为预设
            </Button>
          </div>
          <Button disabled={errors.length > 0} onClick={onClose} size="sm">
            {errors.length > 0 ? '参数有误' : '完成'}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
