/**
 * 专业参数：给懂行的人一个入口，同时不让非法组合溜进 ffmpeg。
 *
 * 设计前提：
 *   - 全部字段可选，null 表示"不干预"，由档位决定（这样默认路径与以前完全一致）；
 *   - 校验只看真实约束（CRF 区间随编码器变、WebM 不收 H.264 等），不猜用户意图；
 *   - 错误拦下、警告放行——像"无损格式上设码率"这种只是没意义，不该阻止转换。
 */
import { resolveContainer, videoCodecFor, type ContainerSpec, type OutputFormat } from './ffmpeg-args';

export interface AdvancedParams {
  /** 视频编码器；null 表示跟随容器与档位 */
  videoCodec: string | null;
  /** 码率控制方式；null 表示跟随档位 */
  rateControl: 'crf' | 'bitrate' | null;
  crf: number | null;
  videoBitrateKbps: number | null;
  /** 编码速度预设（x264 / x265 的那几档） */
  encoderPreset: string | null;
  tune: string | null;
  profile: string | null;
  pixelFormat: string | null;
  /** 关键帧间隔 -g */
  gop: number | null;

  /** 缩放到 宽x高，如 1920x1080 */
  scale: string | null;
  fps: number | null;
  scaleAlgorithm: 'bicubic' | 'lanczos' | 'neighbor' | 'bilinear' | null;

  /** 音频策略；null 表示跟随档位 */
  audioMode: 'copy' | 'encode' | 'none' | null;
  audioCodec: string | null;
  audioBitrateKbps: number | null;
  sampleRate: number | null;
  channels: 1 | 2 | null;

  /** 是否把索引前置（只对 MP4 家族有效） */
  faststart: boolean | null;
  threads: number | null;
  /** 额外的 ffmpeg 开关；危险参数会被拦下 */
  extraArgs: string | null;
}

export const DEFAULT_ADVANCED: AdvancedParams = {
  videoCodec: null,
  rateControl: null,
  crf: null,
  videoBitrateKbps: null,
  encoderPreset: null,
  tune: null,
  profile: null,
  pixelFormat: null,
  gop: null,
  scale: null,
  fps: null,
  scaleAlgorithm: null,
  audioMode: null,
  audioCodec: null,
  audioBitrateKbps: null,
  sampleRate: null,
  channels: null,
  faststart: null,
  threads: null,
  extraArgs: null,
};

/* ── 持久化解析 ──────────────────────────────────────────────────── */

const asText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const asOneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;

/**
 * 从设置文件里解析专业参数。
 *
 * 逐字段校验、逐字段回落默认值：一条被手改坏的值不该让整份参数报废，
 * 也不该让应用起不来——态度与 parseSettings 对其它字段一致。
 * 枚举类字段还兼作白名单：设置文件是纯文本，谁都能往里写一个不存在的编码器名。
 */
export function parseAdvanced(raw: unknown): AdvancedParams {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_ADVANCED };
  const stored = raw as Record<string, unknown>;

  const sampleRate = asNumber(stored.sampleRate);
  const channels = stored.channels === 1 || stored.channels === 2 ? stored.channels : null;

  return {
    videoCodec: asOneOf(
      stored.videoCodec,
      VIDEO_CODECS.map((codec) => codec.value),
    ),
    rateControl: asOneOf(stored.rateControl, ['crf', 'bitrate'] as const),
    crf: asNumber(stored.crf),
    videoBitrateKbps: asNumber(stored.videoBitrateKbps),
    encoderPreset: asOneOf(stored.encoderPreset, ENCODER_PRESETS),
    tune: asOneOf(stored.tune, TUNES),
    profile: asOneOf(stored.profile, PROFILES),
    pixelFormat: asOneOf(stored.pixelFormat, PIXEL_FORMATS),
    gop: asNumber(stored.gop),
    scale: asText(stored.scale),
    fps: asNumber(stored.fps),
    scaleAlgorithm: asOneOf(stored.scaleAlgorithm, SCALE_ALGORITHMS),
    audioMode: asOneOf(stored.audioMode, ['copy', 'encode', 'none'] as const),
    audioCodec: asOneOf(
      stored.audioCodec,
      AUDIO_CODECS.map((codec) => codec.value),
    ),
    audioBitrateKbps: asNumber(stored.audioBitrateKbps),
    sampleRate:
      sampleRate !== null && (SAMPLE_RATES as readonly number[]).includes(sampleRate) ? sampleRate : null,
    channels,
    faststart: typeof stored.faststart === 'boolean' ? stored.faststart : null,
    threads: asNumber(stored.threads),
    extraArgs: asText(stored.extraArgs),
  };
}

/* ── 选项表：界面下拉与校验共用同一份 ─────────────────────────────── */

export const VIDEO_CODECS = [
  { value: 'libx264', label: 'H.264 (libx264)', family: 'h264' },
  { value: 'libx265', label: 'H.265 / HEVC (libx265)', family: 'hevc' },
  { value: 'libvpx-vp9', label: 'VP9 (libvpx-vp9)', family: 'vp9' },
  { value: 'libaom-av1', label: 'AV1 (libaom-av1)', family: 'av1' },
  { value: 'h264_nvenc', label: 'H.264 · NVENC（显卡）', family: 'h264' },
  { value: 'hevc_nvenc', label: 'H.265 · NVENC（显卡）', family: 'hevc' },
  { value: 'h264_qsv', label: 'H.264 · QSV（核显）', family: 'h264' },
  { value: 'hevc_qsv', label: 'H.265 · QSV（核显）', family: 'hevc' },
  { value: 'h264_amf', label: 'H.264 · AMF（AMD）', family: 'h264' },
  { value: 'hevc_amf', label: 'H.265 · AMF（AMD）', family: 'hevc' },
] as const;

export const ENCODER_PRESETS = [
  'ultrafast',
  'superfast',
  'veryfast',
  'faster',
  'fast',
  'medium',
  'slow',
  'slower',
  'veryslow',
] as const;

export const TUNES = ['film', 'animation', 'grain', 'stillimage', 'fastdecode', 'zerolatency'] as const;

export const PROFILES = ['baseline', 'main', 'high', 'high10', 'high422', 'high444', 'main10'] as const;

export const PIXEL_FORMATS = [
  'yuv420p',
  'yuv422p',
  'yuv444p',
  'yuv420p10le',
  'yuv422p10le',
  'yuv444p10le',
  'nv12',
] as const;

export const SCALE_ALGORITHMS = ['bicubic', 'lanczos', 'neighbor', 'bilinear'] as const;

export const AUDIO_CODECS = [
  { value: 'aac', label: 'AAC', lossless: false },
  { value: 'libmp3lame', label: 'MP3 (libmp3lame)', lossless: false },
  { value: 'libopus', label: 'Opus (libopus)', lossless: false },
  { value: 'ac3', label: 'AC-3', lossless: false },
  { value: 'flac', label: 'FLAC（无损）', lossless: true },
  { value: 'pcm_s16le', label: 'PCM 16-bit（无损）', lossless: true },
] as const;

export const SCALE_PRESETS = ['3840x2160', '2560x1440', '1920x1080', '1280x720', '854x480'] as const;

export const FPS_PRESETS = [60, 50, 30, 25, 24] as const;

export const SAMPLE_RATES = [48000, 44100, 32000, 22050] as const;

/* ── 校验 ────────────────────────────────────────────────────────── */

export interface ValidationResult {
  /** 致命问题：有错就不能转换 */
  errors: string[];
  /** 只是没意义或有风险，放行但在界面上提示 */
  warnings: string[];
}

type VideoFamily = 'h264' | 'hevc' | 'vp8' | 'vp9' | 'av1' | 'gif' | 'other';

/** 从编码器名字推断系族：硬件实现也归到同一个系族 */
export function videoFamilyOf(codec: string): VideoFamily {
  const name = codec.toLowerCase();
  if (name.includes('264')) return 'h264';
  if (name.includes('265') || name.includes('hevc')) return 'hevc';
  if (name.includes('vp8')) return 'vp8';
  if (name.includes('vp9')) return 'vp9';
  if (name.includes('av1')) return 'av1';
  if (name === 'gif') return 'gif';
  return 'other';
}

/** 容器装得下的视频系族；空数组表示这个容器不收视频 */
const FAMILIES_BY_CONTAINER: Record<string, VideoFamily[]> = {
  mp4: ['h264', 'hevc', 'av1'],
  mov: ['h264', 'hevc', 'av1'],
  mkv: ['h264', 'hevc', 'vp8', 'vp9', 'av1'],
  webm: ['vp8', 'vp9', 'av1'],
  gif: ['gif'],
  mp3: [],
  m4a: [],
  opus: [],
  flac: [],
  wav: [],
};

/** CRF 的可用区间：VP8/VP9/AV1 是 0–63，其余（x264/x265 及硬件）是 0–51 */
function crfMaxFor(codec: string): number {
  const family = videoFamilyOf(codec);
  return family === 'vp8' || family === 'vp9' || family === 'av1' ? 63 : 51;
}

/** 与程序自己生成的参数冲突、或能改写输入输出的开关，一律不放行 */
const FORBIDDEN_FLAGS = [
  '-i',
  '-y',
  '-n',
  '-filter_complex',
  '-filter:v',
  '-filter:a',
  '-vf',
  '-af',
  '-c:v',
  '-c:a',
  '-codec:v',
  '-codec:a',
  '-map',
  '-f',
  '-progress',
];

function checkExtraArgs(raw: string): string | null {
  const text = raw.trim();
  if (text.length === 0) return null;

  const tokens = text.split(/\s+/);
  for (const token of tokens) {
    if (FORBIDDEN_FLAGS.includes(token)) {
      return `额外参数里不能出现 ${token}：它会和程序自己生成的参数冲突`;
    }
  }
  // 第一个词不是开关，多半是把输出路径之类的裸参数混进来了
  if (!tokens[0]?.startsWith('-')) {
    return '额外参数必须以 - 开头的开关，例如 -movflags +faststart';
  }
  return null;
}

/**
 * 按输出格式校验专业参数。
 *
 * 纯函数，容器由输出格式推导——界面上的校验入口（设置页与主界面的开始按钮）
 * 必须问同一个问题，各推导一次迟早会不一致。
 */
export function validateForFormat(advanced: AdvancedParams, outputFormat: OutputFormat): ValidationResult {
  return validateAdvanced(advanced, resolveContainer(outputFormat, 'x.mkv'));
}

export function validateAdvanced(params: AdvancedParams, container: ContainerSpec): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const effectiveCodec = params.videoCodec ?? videoCodecFor(container, 'balanced', 'none');
  const isAudioContainer = container.media === 'audio';
  const isGif = container.media === 'gif';

  // 编码器与容器
  if (params.videoCodec) {
    const allowed = FAMILIES_BY_CONTAINER[container.kind] ?? [];
    const family = videoFamilyOf(params.videoCodec);

    if (isAudioContainer) {
      errors.push(`${container.kind.toUpperCase()} 是音频容器，不能选视频编码器`);
    } else if (allowed.length === 0 || !allowed.includes(family)) {
      const names = allowed.map((item) => item.toUpperCase()).join(' / ');
      errors.push(`容器 ${container.kind.toUpperCase()} 收不了这个编码器，只支持 ${names || '无'}`);
    }
  }

  if (isGif && (params.crf !== null || params.videoBitrateKbps !== null || params.encoderPreset || params.tune)) {
    warnings.push('GIF 走调色板两遍法，这些编码选项不生效');
  }

  // CRF
  if (params.crf !== null) {
    const max = crfMaxFor(effectiveCodec);
    if (!Number.isFinite(params.crf) || params.crf < 0 || params.crf > max) {
      errors.push(`CRF 要在 0–${max} 之间（${effectiveCodec} 的取值范围）`);
    }
  }

  // 码率
  if (params.videoBitrateKbps !== null) {
    if (!Number.isFinite(params.videoBitrateKbps) || params.videoBitrateKbps < 100 || params.videoBitrateKbps > 200_000) {
      errors.push('视频码率要在 100–200000 kbps 之间');
    }
  }

  // 编码速度
  if (params.encoderPreset && !(ENCODER_PRESETS as readonly string[]).includes(params.encoderPreset)) {
    errors.push(`编码速度只支持这几档：${ENCODER_PRESETS.join(' / ')}`);
  }

  // tune
  if (params.tune && !(TUNES as readonly string[]).includes(params.tune)) {
    errors.push(`tune 只支持这几项：${TUNES.join(' / ')}`);
  }

  // profile
  if (params.profile && !(PROFILES as readonly string[]).includes(params.profile)) {
    errors.push(`profile 只支持这几项：${PROFILES.join(' / ')}`);
  }

  // 像素格式
  if (params.pixelFormat && !(PIXEL_FORMATS as readonly string[]).includes(params.pixelFormat)) {
    errors.push(`像素格式只支持：${PIXEL_FORMATS.join(' / ')}`);
  }

  // 关键帧间隔
  if (params.gop !== null && (!Number.isInteger(params.gop) || params.gop < 1 || params.gop > 600)) {
    errors.push('关键帧间隔要在 1–600 之间');
  }

  // 缩放
  if (params.scale) {
    const match = /^(\d{2,5})x(\d{2,5})$/.exec(params.scale.trim());
    if (!match) {
      errors.push('缩放要写成 宽x高，例如 1920x1080');
    } else {
      const width = Number(match[1]);
      const height = Number(match[2]);
      if (width < 16 || height < 16 || width > 7680 || height > 7680) {
        errors.push('缩放后的宽高要在 16–7680 之间');
      }
    }
  }

  // 帧率
  if (params.fps !== null && (!Number.isFinite(params.fps) || params.fps < 1 || params.fps > 240)) {
    errors.push('帧率要在 1–240 之间');
  }

  // 缩放算法
  if (params.scaleAlgorithm && !(SCALE_ALGORITHMS as readonly string[]).includes(params.scaleAlgorithm)) {
    errors.push(`缩放算法只支持：${SCALE_ALGORITHMS.join(' / ')}`);
  }

  // 音频
  if (params.audioCodec && !AUDIO_CODECS.some((item) => item.value === params.audioCodec)) {
    errors.push(`音频编码器只支持：${AUDIO_CODECS.map((item) => item.value).join(' / ')}`);
  }

  if (params.audioBitrateKbps !== null) {
    if (!Number.isFinite(params.audioBitrateKbps) || params.audioBitrateKbps < 32 || params.audioBitrateKbps > 512) {
      errors.push('音频码率要在 32–512 kbps 之间');
    }
    const codec = AUDIO_CODECS.find((item) => item.value === params.audioCodec);
    if (codec?.lossless) {
      warnings.push(`${codec.label} 是无损格式，码率参数不生效`);
    }
  }

  if (params.sampleRate !== null && (!Number.isFinite(params.sampleRate) || params.sampleRate < 8000 || params.sampleRate > 192_000)) {
    errors.push('采样率要在 8000–192000 Hz 之间');
  }

  if (params.audioMode === 'none' && (params.audioCodec || params.audioBitrateKbps !== null)) {
    warnings.push('已经选了移除音轨，音频编码设置不会生效');
  }

  if (isAudioContainer && params.audioMode === 'none') {
    errors.push('目标是音频格式，不能移除音轨');
  }

  // 容器与其它
  if (params.faststart !== null && !['mp4', 'mov', 'm4a'].includes(container.kind)) {
    warnings.push('faststart 只对 MP4 家族有意义');
  }

  if (params.threads !== null && (!Number.isInteger(params.threads) || params.threads < 1 || params.threads > 64)) {
    errors.push('线程数要在 1–64 之间');
  }

  if (params.extraArgs) {
    const problem = checkExtraArgs(params.extraArgs);
    if (problem) errors.push(problem);
  }

  return { errors, warnings };
}

/** 是否一项都没动过；界面据此决定要不要显示"已自定义"标记 */
export function isAdvancedEmpty(params: AdvancedParams): boolean {
  return Object.values(params).every((value) => value === null);
}

/** 参数摘要，一行一项，给界面显示用 */
export function describeAdvanced(params: AdvancedParams): string[] {
  const lines: string[] = [];

  if (params.videoCodec) lines.push(`编码器 ${params.videoCodec}`);
  if (params.crf !== null) lines.push(`CRF ${params.crf}`);
  if (params.videoBitrateKbps !== null) lines.push(`码率 ${params.videoBitrateKbps} kbps`);
  if (params.encoderPreset) lines.push(`速度 ${params.encoderPreset}`);
  if (params.tune) lines.push(`tune ${params.tune}`);
  if (params.profile) lines.push(`profile ${params.profile}`);
  if (params.pixelFormat) lines.push(`像素格式 ${params.pixelFormat}`);
  if (params.gop !== null) lines.push(`关键帧间隔 ${params.gop}`);

  const picture = [
    params.scale,
    params.fps !== null ? `${params.fps} fps` : null,
    params.scaleAlgorithm,
  ].filter((item): item is string => Boolean(item));
  if (picture.length > 0) lines.push(`画面 ${picture.join(' · ')}`);

  if (params.audioMode === 'none') {
    lines.push('移除音轨');
  } else if (params.audioMode === 'copy') {
    lines.push('音频保持原样');
  } else {
    const audio = [
      params.audioCodec,
      params.audioBitrateKbps !== null ? `${params.audioBitrateKbps} kbps` : null,
      params.sampleRate !== null ? `${params.sampleRate} Hz` : null,
      params.channels === 1 ? '单声道' : params.channels === 2 ? '立体声' : null,
    ].filter((item): item is string => Boolean(item));
    if (audio.length > 0) lines.push(`音频 ${audio.join(' · ')}`);
  }

  if (params.faststart !== null) lines.push(params.faststart ? 'faststart 开' : 'faststart 关');
  if (params.threads !== null) lines.push(`线程 ${params.threads}`);
  if (params.extraArgs?.trim()) lines.push(`额外 ${params.extraArgs.trim()}`);

  return lines;
}
