/**
 * 解析 ffprobe 的 JSON 输出。
 *
 * 原则：只提取界面需要的字段；拿不准的一律给 null，由界面降级展示。
 * 这样"字段异常"永远表现为少显示一项，而不是漏出 NaN 或把界面撑坏。
 */

export interface MediaInfo {
  path: string;
  sizeBytes: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  channels: number | null;
  container: string | null;
  bitrateKbps: number | null;
  hasAudio: boolean;
}

function numOrNull(value: unknown): number | null {
  const numeric =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

/** 把 "30000/1001" 这样的分数帧率换算成小数；"0/0"、空值、异常值都返回 null。 */
export function parseFrameRate(rate: string | null | undefined): number | null {
  if (typeof rate !== 'string' || rate.length === 0) return null;

  const [numeratorRaw, denominatorRaw] = rate.split('/');
  const numerator = Number(numeratorRaw);
  const denominator = denominatorRaw === undefined ? 1 : Number(denominatorRaw);

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (numerator <= 0 || denominator <= 0) return null;

  return Math.round((numerator / denominator) * 1000) / 1000;
}

export function parseMediaInfo(json: unknown, meta: { path: string; sizeBytes: number }): MediaInfo {  if (!json || typeof json !== 'object') {
    throw new Error('ffprobe 输出不是对象');
  }

  const root = json as { streams?: unknown; format?: unknown };
  if (!Array.isArray(root.streams)) {
    throw new Error('ffprobe 输出缺少 streams 数组');
  }

  const streams = root.streams.filter(
    (s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object',
  );
  const video = streams.find((s) => s.codec_type === 'video');
  const audio = streams.find((s) => s.codec_type === 'audio');
  const format: Record<string, unknown> =
    root.format && typeof root.format === 'object' ? (root.format as Record<string, unknown>) : {};

  const duration = numOrNull(format.duration);
  const bitRate = numOrNull(format.bit_rate);

  return {
    path: meta.path,
    sizeBytes: meta.sizeBytes,
    durationSec: duration !== null && duration > 0 ? duration : null,
    width: video ? numOrNull(video.width) : null,
    height: video ? numOrNull(video.height) : null,
    fps: video ? parseFrameRate(typeof video.r_frame_rate === 'string' ? video.r_frame_rate : null) : null,
    videoCodec: video && typeof video.codec_name === 'string' ? video.codec_name : null,
    audioCodec: audio && typeof audio.codec_name === 'string' ? audio.codec_name : null,
    channels: audio ? numOrNull(audio.channels) : null,
    container: typeof format.format_name === 'string' ? format.format_name : null,
    bitrateKbps: bitRate !== null ? Math.round(bitRate / 1000) : null,
    hasAudio: Boolean(audio),
  };
}

export interface Convertibility {
  ok: boolean;
  /** 不可转换时的原因，直接展示给用户 */
  reason: string | null;
}

/** 常见的视频容器。ffprobe 会为它猜出来的格式给出冷门容器名（cdg、adp 等），靠这张表拦住。 */
const KNOWN_VIDEO_CONTAINERS = [
  'mp4', 'mov', 'm4a', '3gp', '3g2', 'mj2',
  'matroska', 'webm',
  'avi', 'flv', 'asf', 'wmv',
  'mpeg', 'mpegts', 'mpg',
  'ogg', 'ogv',
  'mxf', 'gxf', 'nut', 'y4m', 'rm', 'vob', 'dv',
];

function isKnownContainer(container: string | null): boolean {
  if (!container) return false;
  const lower = container.toLowerCase();
  return KNOWN_VIDEO_CONTAINERS.some((hint) => lower.includes(hint));
}

/**
 * 判断这个文件能不能转。
 *
 * 为什么不能只看 ffprobe 的退出码：实测把垃圾数据交给它，多半不会报错——
 *   全 0x09 的字节 → 猜成 cdg 容器的 cdgraphics 视频（300x216，还带 9.1 秒时长）；
 *   前段 0x09 后段全 0 → 猜成 adp 容器的 adpcm_dtk 音频。
 * 所以判断要落在"有没有视频轨"和"容器是不是常见的视频容器"这两件事上，
 * 把明显不是视频的文件挡在导入阶段，而不是等用户点了开始才失败。
 */
export function assessConvertibility(info: MediaInfo): Convertibility {
  if (!info.videoCodec) {
    return { ok: false, reason: '这个文件里没有视频轨，无法转换' };
  }
  if (!isKnownContainer(info.container)) {
    const shown = info.container ?? '未知';
    return { ok: false, reason: `不是常见的视频容器（识别为 ${shown}），可能不是视频文件` };
  }
  return { ok: true, reason: null };
}
