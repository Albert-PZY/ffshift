/**
 * ffmpeg 参数构造：唯一的参数来源，界面与 AI 建议最终都汇到这里。
 * 纯函数，不碰进程与文件系统。
 *
 * 细节依据 docs/architecture.md §6.4 与附录 A：
 *   - 数组传参，不做 shell 转义（中文与空格路径原样交给 ffmpeg）；
 *   - 进度用 `-progress pipe:1 -nostats`，stdout 交给进度解析器；
 *   - 目标体积按 `8192 × 目标MB ÷ 时长 - 音频kbps` 反推码率。
 */

export type Preset = 'clear' | 'balanced' | 'small';
export type HwAccel = 'none' | 'nvenc' | 'qsv' | 'amf';

export interface ConvertOptions {
  input: string;
  output: string;
  preset: Preset;
  /** 硬件加速方式，缺省为软编 */
  hw?: HwAccel;
  /** 源文件是否有音轨；无音轨时不能带音频参数，否则 ffmpeg 直接报错 */
  hasAudio?: boolean;
  /** 目标体积（MiB）；给出后改用码率模式 */
  targetSizeMiB?: number | null;
  /** 源时长（秒）；目标体积模式必需。null 表示未知 */
  durationSec?: number | null;
}

interface PresetSpec {
  /** 质量值：软编走 crf，硬编走 cq / global_quality */
  quality: number;
  /** 仅软编使用的 preset 档 */
  x264Preset: string;
  audioKbps: number;
}

const PRESETS: Record<Preset, PresetSpec> = {
  clear: { quality: 18, x264Preset: 'slow', audioKbps: 192 },
  balanced: { quality: 21, x264Preset: 'medium', audioKbps: 128 },
  small: { quality: 26, x264Preset: 'medium', audioKbps: 96 },
};

function videoEncoder(preset: Preset, hw: HwAccel): string {
  const hevc = preset === 'small';
  switch (hw) {
    case 'nvenc':
      return hevc ? 'hevc_nvenc' : 'h264_nvenc';
    case 'qsv':
      return hevc ? 'hevc_qsv' : 'h264_qsv';
    case 'amf':
      return hevc ? 'hevc_amf' : 'h264_amf';
    default:
      return hevc ? 'libx265' : 'libx264';
  }
}

/** 由目标体积反推视频码率；过低时保底，避免产出没法看的视频。 */
export function estimateVideoBitrateKbps(
  targetSizeMiB: number,
  durationSec: number,
  audioKbps: number,
): number {
  const kbps = (8192 * targetSizeMiB) / durationSec - audioKbps;
  return Math.max(100, Math.round(kbps));
}

export function buildArgs(options: ConvertOptions): string[] {
  const { input, output, preset, hw = 'none', hasAudio = false, targetSizeMiB, durationSec } = options;
  const spec = PRESETS[preset];
  if (!spec) throw new Error(`未知档位：${preset}`);

  const args: string[] = [
    '-hide_banner',
    '-y',
    '-progress',
    'pipe:1',
    '-nostats',
    '-i',
    input,
    '-c:v',
    videoEncoder(preset, hw),
  ];

  if (targetSizeMiB !== undefined && targetSizeMiB !== null) {
    if (durationSec === undefined || durationSec === null || !Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error('目标体积模式需要时长（durationSec），否则无法反推码率');
    }
    args.push('-b:v', `${estimateVideoBitrateKbps(targetSizeMiB, durationSec, spec.audioKbps)}k`);
  } else {
    switch (hw) {
      case 'nvenc':
        args.push('-cq', String(spec.quality));
        break;
      case 'qsv':
        args.push('-global_quality', String(spec.quality));
        break;
      case 'amf':
        args.push('-rc', 'cqp', '-qp_i', String(spec.quality), '-qp_p', String(spec.quality));
        break;
      default:
        args.push('-crf', String(spec.quality), '-preset', spec.x264Preset);
        break;
    }
  }

  if (hasAudio) {
    args.push('-c:a', 'aac', '-b:a', `${spec.audioKbps}k`);
  }

  // 让 moov 前置，播放器可以边下边播
  args.push('-movflags', '+faststart', output);
  return args;
}

/** 输出路径：同目录、同扩展名，插入 .ffshift 后缀，绝不覆盖源文件。 */
export function suggestOutputPath(input: string): string {
  const lastDot = input.lastIndexOf('.');
  const lastSlash = Math.max(input.lastIndexOf('\\'), input.lastIndexOf('/'));

  if (lastDot > lastSlash && lastDot > 0) {
    return `${input.slice(0, lastDot)}.ffshift${input.slice(lastDot)}`;
  }
  return `${input}.ffshift.mp4`;
}
