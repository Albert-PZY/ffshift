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

export function parseMediaInfo(json: unknown, meta: { path: string; sizeBytes: number }): MediaInfo {
  if (!json || typeof json !== 'object') {
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
