/**
 * ffmpeg 参数构造：唯一的参数来源，界面与 AI 建议最终都汇到这里。
 * 纯函数，不碰进程与文件系统。
 *
 * 三条路径，由目标容器决定走哪条：
 *   - video：视频转视频（容器决定编码器，见 CONTAINERS）
 *   - audio：从视频里提取音轨（丢弃视频轨）
 *   - gif：动图，用调色板两遍法
 *
 * 通用约定：
 *   - 数组传参，不做 shell 转义（中文与空格路径原样交给 ffmpeg）；
 *   - 进度用 `-progress pipe:1 -nostats`，stdout 交给进度解析器；
 *   - 目标体积按 `8192 × 目标MB ÷ 时长 - 音频kbps` 反推码率。
 */

export type Preset = 'clear' | 'balanced' | 'small';
export type HwAccel = 'none' | 'nvenc' | 'qsv' | 'amf';

/** 目标格式；same 表示跟随输入文件的容器 */
export type OutputFormat =
  | 'same'
  | 'mp4'
  | 'mkv'
  | 'mov'
  | 'webm'
  | 'gif'
  | 'mp3'
  | 'm4a'
  | 'opus'
  | 'flac'
  | 'wav';

export type ContainerKind = Exclude<OutputFormat, 'same'>;

/** 源视频的渲染信息，用来判断要不要先合成底色 */
export interface SourceVideoInfo {
  width: number | null;
  height: number | null;
  fps: number | null;
  /** 带透明通道的源转 yuv 编码会把透明区变黑，需要先合成背景 */
  hasAlpha: boolean;
}

export interface ConvertOptions {
  input: string;
  output: string;
  preset: Preset;
  /** 目标格式，缺省 same（跟随输入） */
  format?: OutputFormat;
  /** 硬件加速方式，缺省为软编 */
  hw?: HwAccel;
  /** 源文件是否有音轨；无音轨时不能带音频参数，音频目标也无法进行 */
  hasAudio?: boolean;
  /** 目标体积（MiB）；给出后改用码率模式 */
  targetSizeMiB?: number | null;
  /** 源时长（秒）；目标体积模式必需。null 表示未知 */
  durationSec?: number | null;
  /** 源视频信息；缺省视为不带透明通道 */
  source?: SourceVideoInfo;
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
  kind: ContainerKind;
  extension: string;
  /** 这个容器装什么 */
  media: 'video' | 'audio' | 'gif';
  /** 能不能吃硬件编码器（WebM 只认 VP9，GIF 没有硬件实现） */
  hardware: boolean;
  /** 容器强制的视频编码器；不写就按档位与硬件加速选 */
  forcedVideoCodec?: string;
  /** 视频容器的音频编码器；null 表示这个容器本来就不带音频 */
  audioCodec?: string | null;
  /** 音频容器的完整音频参数（各格式的码率与质量参数不同） */
  audioArgs?: string[];
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
    media: 'video',
    hardware: true,
    audioCodec: 'aac',
    // moov 前置，播放器可以边下边播
    muxerArgs: ['-movflags', '+faststart'],
  },
  {
    kind: 'mov',
    extension: 'mov',
    media: 'video',
    hardware: true,
    audioCodec: 'aac',
    muxerArgs: ['-movflags', '+faststart'],
  },
  {
    kind: 'mkv',
    extension: 'mkv',
    media: 'video',
    hardware: true,
    audioCodec: 'aac',
    // Matroska 不是 MP4 家族，没有 movflags 这个选项，加了也是被静默忽略
    muxerArgs: [],
  },
  {
    kind: 'webm',
    extension: 'webm',
    media: 'video',
    hardware: false,
    // 容器只接受 VP8 / VP9 / AV1，所以忽略硬件加速
    forcedVideoCodec: 'libvpx-vp9',
    audioCodec: 'libopus',
    muxerArgs: [],
  },
  {
    kind: 'gif',
    extension: 'gif',
    media: 'gif',
    hardware: false,
    audioCodec: null,
    // 0 表示无限循环；GIF 没有音轨
    muxerArgs: ['-loop', '0'],
  },
  // 以下为音频容器：把视频当音源，丢弃视频轨
  {
    kind: 'mp3',
    extension: 'mp3',
    media: 'audio',
    hardware: false,
    audioArgs: ['-c:a', 'libmp3lame', '-q:a', '2'],
    muxerArgs: [],
  },
  {
    kind: 'm4a',
    extension: 'm4a',
    media: 'audio',
    hardware: false,
    audioArgs: ['-c:a', 'aac', '-b:a', '192k'],
    muxerArgs: ['-movflags', '+faststart'],
  },
  {
    kind: 'opus',
    extension: 'opus',
    media: 'audio',
    hardware: false,
    audioArgs: ['-c:a', 'libopus', '-b:a', '160k'],
    muxerArgs: [],
  },
  {
    kind: 'flac',
    extension: 'flac',
    media: 'audio',
    hardware: false,
    // 无损：不带码率参数
    audioArgs: ['-c:a', 'flac'],
    muxerArgs: [],
  },
  {
    kind: 'wav',
    extension: 'wav',
    media: 'audio',
    hardware: false,
    audioArgs: ['-c:a', 'pcm_s16le'],
    muxerArgs: [],
  },
];

/** 这个容器最终用哪个视频编码器：容器强制的优先，否则按档位与硬件加速选。 */
export function videoCodecFor(container: ContainerSpec, preset: Preset, hw: HwAccel = 'none'): string {
  return container.forcedVideoCodec ?? h26xEncoder(preset, hw);
}

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

interface AlphaComposite {
  /** 额外那路底色输入的 lavfi 描述 */
  input: string;
  filter: string;
  label: string;
}

/**
 * 带透明通道的源需要先合成底色。
 *
 * 为什么：DXV3（rgba）、RLE（argb）这类素材的透明区在 RGB 里是 0，也就是黑色；
 * 直接转成 yuv 编码（H.264 / H.265 / VP9）会丢掉 alpha，透明区就变成黑块。
 * 做法是加一路纯色输入，用 overlay 把源叠在上面。
 */
function alphaComposite(container: ContainerSpec, source?: SourceVideoInfo): AlphaComposite | null {
  if (container.media !== 'video' || !source?.hasAlpha) return null;

  const width = source.width && source.width > 0 ? source.width : 1280;
  const height = source.height && source.height > 0 ? source.height : 720;
  const fps = source.fps && source.fps > 0 ? source.fps : 30;

  return {
    input: `color=white:s=${width}x${height}:r=${fps}`,
    filter: '[1:v][0:v]overlay=shortest=1[composited]',
    label: 'composited',
  };
}

function videoArgs(
  options: ConvertOptions,
  container: ContainerSpec,
  presetSpec: PresetSpec,
): string[] {
  const { preset, hasAudio = false, targetSizeMiB, durationSec, source } = options;
  const hw: HwAccel = container.hardware ? (options.hw ?? 'none') : 'none';

  const args: string[] = [];
  const composite = alphaComposite(container, source);
  if (composite) args.push('-f', 'lavfi', '-i', composite.input);

  args.push('-c:v', videoCodecFor(container, preset, hw));

  if (targetSizeMiB !== undefined && targetSizeMiB !== null) {
    if (durationSec === undefined || durationSec === null || !Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error('目标体积模式需要时长（durationSec），否则无法反推码率');
    }
    args.push('-b:v', `${estimateVideoBitrateKbps(targetSizeMiB, durationSec, presetSpec.audioKbps)}k`);
  } else if (container.kind === 'webm') {
    // VP9 要恒定质量必须把目标码率设 0，否则会变成受限质量模式；
    // row-mt 开多线程，不然 VP9 慢到没法用
    args.push('-crf', String(presetSpec.quality), '-b:v', '0', '-row-mt', '1');
  } else {
    switch (hw) {
      case 'nvenc':
        args.push('-cq', String(presetSpec.quality));
        break;
      case 'qsv':
        args.push('-global_quality', String(presetSpec.quality));
        break;
      case 'amf':
        args.push('-rc', 'cqp', '-qp_i', String(presetSpec.quality), '-qp_p', String(presetSpec.quality));
        break;
      default:
        args.push('-crf', String(presetSpec.quality), '-preset', presetSpec.x264Preset);
        break;
    }
  }

  if (hasAudio && container.audioCodec) {
    args.push('-c:a', container.audioCodec, '-b:a', `${presetSpec.audioKbps}k`);
  }

  if (composite) {
    // 用了 filter_complex 之后默认流选择失效，视频与音频都要显式映射
    args.push('-filter_complex', composite.filter, '-map', `[${composite.label}]`);
    if (hasAudio && container.audioCodec) args.push('-map', '0:a?');
  }

  return args;
}

function audioArgs(options: ConvertOptions, container: ContainerSpec): string[] {
  if (!options.hasAudio) {
    throw new Error('源文件没有音频轨道，无法转换成音频格式');
  }

  const args: string[] = ['-vn', ...(container.audioArgs ?? [])];

  // 指定了目标体积时，用码率覆盖掉容器自带的码率/质量参数
  const { targetSizeMiB, durationSec } = options;
  if (targetSizeMiB !== undefined && targetSizeMiB !== null) {
    if (durationSec === undefined || durationSec === null || !Number.isFinite(durationSec) || durationSec <= 0) {
      throw new Error('目标体积模式需要时长（durationSec），否则无法反推码率');
    }
    const audioKbps = Math.max(32, Math.round((8192 * targetSizeMiB) / durationSec));
    const rateIndex = args.indexOf('-b:a');
    if (rateIndex >= 0) args.splice(rateIndex + 1, 1, `${audioKbps}k`);
    else args.push('-b:a', `${audioKbps}k`);
  }

  return args;
}

function gifArgs(): string[] {
  // 调色板两遍法：先用 palettegen 生成调色板，再用 paletteuse 上色。
  // stats_mode=diff 按帧差异生成，减少闪烁；sierra2_4a 抖动让渐变更平滑。
  return [
    '-vf',
    'fps=12,scale=min(720\\,iw):-2:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a',
  ];
}

export function buildArgs(options: ConvertOptions): string[] {
  const presetSpec = PRESETS[options.preset];
  if (!presetSpec) throw new Error(`未知档位：${options.preset}`);

  const container = resolveContainer(options.format ?? 'same', options.input, options.output);
  const head = ['-hide_banner', '-y', '-progress', 'pipe:1', '-nostats', '-i', options.input];

  if (container.media === 'audio') {
    return [...head, ...audioArgs(options, container), ...container.muxerArgs, options.output];
  }
  if (container.media === 'gif') {
    return [...head, ...gifArgs(), ...container.muxerArgs, options.output];
  }
  return [...head, ...videoArgs(options, container, presetSpec), ...container.muxerArgs, options.output];
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
