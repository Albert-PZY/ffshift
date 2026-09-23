/**
 * ffmpeg 参数构造：唯一的参数来源，界面与 AI 建议最终都汇到这里。
 * 纯函数，不碰进程与文件系统。
 *
 * 细节依据 docs/architecture.md §6.4 与附录 A：
 *   - 数组传参，不做 shell 转义（中文与空格路径原样交给 ffmpeg）；
 *   - 进度用 `-progress pipe:1 -nostats`，stdout 交给进度解析器；
 *   - 目标体积按 `8192 × 目标MB ÷ 时长 - 音频kbps` 反推码率。
 *
 * 输出格式（容器）决定编码器，不是反过来：容器只接受特定编码组合，
 * 选错了 ffmpeg 会直接拒绝写文件（例如 WebM 不收 H.264）。
 */

export type Preset = 'clear' | 'balanced' | 'small';
export type HwAccel = 'none' | 'nvenc' | 'qsv' | 'amf';
/** 目标格式；same 表示跟随输入文件的容器 */
export type OutputFormat = 'same' | 'mp4' | 'mkv' | 'mov' | 'webm';

export interface ConvertOptions {
  input: string;
  output: string;
  preset: Preset;
  /** 目标格式，缺省 same（跟随输入） */
  format?: OutputFormat;
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

export interface ContainerSpec {
  kind: 'mp4' | 'mkv' | 'mov' | 'webm';
  extension: string;
  /** 该容器是否吃得下硬件编码器（WebM 只认 VP8/VP9/AV1，硬编帮不上忙） */
  hardware: boolean;
  videoCodec: (preset: Preset, hw?: HwAccel) => string;
  audioCodec: string;
  /** 容器专属的封装参数 */
  muxerArgs: string[];
}

function h26xEncoder(preset: Preset, hw: HwAccel = 'none'): string {
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

const CONTAINERS: ContainerSpec[] = [
  {
    kind: 'mp4',
    extension: 'mp4',
    hardware: true,
    videoCodec: h26xEncoder,
    audioCodec: 'aac',
    // moov 前置，播放器可以边下边播
    muxerArgs: ['-movflags', '+faststart'],
  },
  {
    kind: 'mov',
    extension: 'mov',
    hardware: true,
    videoCodec: h26xEncoder,
    audioCodec: 'aac',
    muxerArgs: ['-movflags', '+faststart'],
  },
  {
    kind: 'mkv',
    extension: 'mkv',
    hardware: true,
    videoCodec: h26xEncoder,
    audioCodec: 'aac',
    // Matroska 不是 MP4 家族，没有 movflags 这个选项，加了也是被静默忽略
    muxerArgs: [],
  },
  {
    kind: 'webm',
    extension: 'webm',
    hardware: false,
    // 容器只接受 VP8 / VP9 / AV1，所以忽略硬件加速
    videoCodec: () => 'libvpx-vp9',
    audioCodec: 'libopus',
    muxerArgs: [],
  },
];

function extensionOf(path: string): string | null {
  const lastDot = path.lastIndexOf('.');
  const lastSlash = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  if (lastDot > lastSlash && lastDot > 0) return path.slice(lastDot + 1).toLowerCase();
  return null;
}

/**
 * 目标格式 + 输入路径 → 用哪个容器。
 *
 * 输出扩展名优先：ffmpeg 是按输出文件名选 muxer 的，参数必须跟它一致。
 * 参数与文件名打架时（例如格式选了"保持原格式"、文件名却是 .webm），
 * 按文件名走才不会撞上"这个容器不收这个编码"。
 */
export function resolveContainer(
  format: OutputFormat,
  inputPath: string,
  outputPath?: string,
): ContainerSpec {
  const fallback = CONTAINERS[0] as ContainerSpec;

  const byOutput = outputPath
    ? CONTAINERS.find((container) => container.extension === extensionOf(outputPath))
    : undefined;
  if (byOutput) return byOutput;

  if (format === 'same') {
    return CONTAINERS.find((container) => container.extension === extensionOf(inputPath)) ?? fallback;
  }
  return CONTAINERS.find((container) => container.kind === format) ?? fallback;
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
  const {
    input,
    output,
    preset,
    format = 'same',
    hw = 'none',
    hasAudio = false,
    targetSizeMiB,
    durationSec,
  } = options;

  const spec = PRESETS[preset];
  if (!spec) throw new Error(`未知档位：${preset}`);

  const container = resolveContainer(format, input, output);
  const effectiveHw: HwAccel = container.hardware ? hw : 'none';

  const args: string[] = [
    '-hide_banner',
    '-y',
    '-progress',
    'pipe:1',
    '-nostats',
    '-i',
    input,
    '-c:v',
    container.videoCodec(preset, effectiveHw),
  ];

  if (targetSizeMiB !== undefined && targetSizeMiB !== null) {
    if (durationSec === undefined || durationSec === null || !Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error('目标体积模式需要时长（durationSec），否则无法反推码率');
    }
    args.push('-b:v', `${estimateVideoBitrateKbps(targetSizeMiB, durationSec, spec.audioKbps)}k`);
  } else if (container.kind === 'webm') {
    // VP9 要恒定质量必须把目标码率设 0，否则会变成受限质量模式；
    // row-mt 开多线程，不然 VP9 慢到没法用
    args.push('-crf', String(spec.quality), '-b:v', '0', '-row-mt', '1');
  } else {
    switch (effectiveHw) {
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
    args.push('-c:a', container.audioCodec, '-b:a', `${spec.audioKbps}k`);
  }

  args.push(...container.muxerArgs, output);
  return args;
}

/** 输出路径：同目录、按目标格式给扩展名，插入 .ffshift 后缀，绝不覆盖源文件。 */
export function outputPathFor(input: string, format: OutputFormat): string {
  const container = resolveContainer(format, input);
  const lastDot = input.lastIndexOf('.');
  const lastSlash = Math.max(input.lastIndexOf('\\'), input.lastIndexOf('/'));
  const hasExtension = lastDot > lastSlash && lastDot > 0;
  const stem = hasExtension ? input.slice(0, lastDot) : input;

  return `${stem}.ffshift.${container.extension}`;
}

/** 保留旧名字：默认跟随输入格式 */
export function suggestOutputPath(input: string, format: OutputFormat = 'same'): string {
  return outputPathFor(input, format);
}
