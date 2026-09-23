import { X } from 'lucide-react';
import { useState } from 'react';
import { NumberParam, SelectParam, TextParam } from '@/components/app/settings/param-field';
import { SettingsBlock, SettingsRow, SettingsSection } from '@/components/app/settings/settings-section';
import { Button } from '@/components/ui/button';
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
  validateForFormat,
} from '@/lib/advanced-params';
import { BUILTIN_PRESETS } from '@/lib/presets';
import { useStore } from '@/store';

/**
 * 参数预设：懂 ffmpeg 的人在设置里一次配好，之后每次转换都用它。
 *
 * 三条原则沿用参数面板时期，只是从对话框搬进了设置页：
 *   - 「不干预」永远是默认值（字段为 null），所以不用这个功能时产出的命令与它不存在时一致；
 *   - 校验实时显示，有错就挡住主界面的「开始转换」——不带着非法参数去转换；
 *   - 预设既能一键套用，也能存下来、导出给同事。
 *
 * 参数本身现在会落盘（见 ADR-018）：它进了设置页，就该按设置的语义走。
 */
export function ParamsSection() {
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

  const { errors, warnings } = validateForFormat(advanced, outputFormat);

  return (
    <>
      {errors.length > 0 && (
        // 贴在滚动区顶部：参数网格有一屏多高，校验结果显示在底部等于没有
        <div
          className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 space-y-1 border-b border-destructive/32 bg-background px-6 py-3"
          data-slot="params-errors"
          key={errors.join('|')}
        >
          {errors.map((error) => (
            <p className="text-xs/relaxed text-destructive" data-slot="reason" key={error}>
              {error}
            </p>
          ))}
        </div>
      )}

      <SettingsSection
        description="预设是一整套参数的组合，一键套用。改动会立刻生效，并记住到下次启动。"
        title="参数预设"
      >
        <SettingsBlock label="内置预设">
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
          </div>
        </SettingsBlock>

        <SettingsBlock
          hint="点名字套用，点叉删掉。存的是与默认不同的字段，所以套用之后其余项仍然按档位走。"
          label={`我的预设${presets.length > 0 ? `（${presets.length}）` : ''}`}
        >
          {presets.length === 0 ? (
            <p className="text-xs text-muted-foreground">还没有保存过预设。</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
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
                    className="grid size-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                    type="button"
                    onClick={() => deletePreset(preset.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="mt-2.5 flex items-center gap-1.5">
            <Input
              className="max-w-64"
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
        </SettingsBlock>

        <SettingsRow hint="导出的 JSON 可以在另一台机器导入，同名预设会跳过。" label="导入 / 导出">
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
            variant="outline"
          >
            导入
          </Button>
          <Button disabled={presets.length === 0} onClick={() => void exportPresetFile()} size="sm" variant="outline">
            导出
          </Button>
        </SettingsRow>

        {notice && <p className="pt-3 text-xs text-muted-foreground">{notice}</p>}
      </SettingsSection>

      <SettingsSection
        description="不填的项按档位走：只用档位时，这里动与不动产出的命令完全一样。"
        title="参数"
      >
        <SettingsBlock label="视频编码">
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
        </SettingsBlock>

        <SettingsBlock hint="缩放也可以直接手填宽高，例如 1920x1080（不一定是下面那几档）。" label="画面">
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
        </SettingsBlock>

        <SettingsBlock label="音频">
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
        </SettingsBlock>

        <SettingsBlock label="容器与性能">
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
        </SettingsBlock>

        <SettingsRow hint="把所有项恢复成「不干预」，由档位决定一切。" label="重置">
          <Button onClick={resetAdvanced} size="sm" variant="outline">
            全部重置
          </Button>
        </SettingsRow>
      </SettingsSection>

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((warning) => (
            <p className="text-xs text-muted-foreground" key={warning}>
              {warning}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
