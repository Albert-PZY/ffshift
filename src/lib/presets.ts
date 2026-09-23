/**
 * 参数预设：把一组专业参数存下来复用。
 *
 * 内置预设是"常见需求的现成答案"，用户预设是自己攒的。
 * 两者用同一个结构（CustomPreset），区别只在能不能删。
 */
import { DEFAULT_ADVANCED, type AdvancedParams } from './advanced-params';

export interface CustomPreset {
  id: string;
  name: string;
  /** 只存改过的字段；应用时与默认值合并 */
  params: Partial<AdvancedParams>;
  createdAt: string;
}

/** 内置预设：覆盖最常见的几种诉求，点一下就应用 */
export const BUILTIN_PRESETS: CustomPreset[] = [
  {
    id: 'builtin-web',
    name: '网页分享',
    createdAt: '',
    params: {
      videoCodec: 'libx264',
      crf: 23,
      encoderPreset: 'medium',
      profile: 'high',
      pixelFormat: 'yuv420p',
      faststart: true,
      audioMode: 'encode',
      audioCodec: 'aac',
      audioBitrateKbps: 128,
    },
  },
  {
    id: 'builtin-archive',
    name: '高画质存档',
    createdAt: '',
    params: {
      videoCodec: 'libx265',
      crf: 18,
      encoderPreset: 'slow',
      audioMode: 'encode',
      audioCodec: 'aac',
      audioBitrateKbps: 192,
    },
  },
  {
    id: 'builtin-tiny',
    name: '极限压缩',
    createdAt: '',
    params: {
      videoCodec: 'libx265',
      crf: 28,
      encoderPreset: 'medium',
      audioMode: 'encode',
      audioCodec: 'aac',
      audioBitrateKbps: 64,
    },
  },
  {
    id: 'builtin-mobile',
    name: '手机播放',
    createdAt: '',
    params: {
      videoCodec: 'libx264',
      crf: 24,
      scale: '1280x720',
      fps: 30,
      profile: 'main',
      faststart: true,
      audioMode: 'encode',
      audioCodec: 'aac',
      audioBitrateKbps: 96,
    },
  },
  {
    id: 'builtin-silent',
    name: '去掉声音',
    createdAt: '',
    params: { audioMode: 'none' },
  },
  {
    id: 'builtin-gpu',
    name: '显卡加速',
    createdAt: '',
    params: {
      videoCodec: 'h264_nvenc',
      rateControl: 'bitrate',
      videoBitrateKbps: 8000,
      audioMode: 'copy',
    },
  },
  {
    id: 'builtin-audio-only',
    name: '只留声音',
    createdAt: '',
    params: { audioMode: 'encode', audioCodec: 'aac', audioBitrateKbps: 192 },
  },
];

/** 把只存了部分字段的预设补成完整参数 */
export function presetToParams(preset: CustomPreset): AdvancedParams {
  return { ...DEFAULT_ADVANCED, ...preset.params };
}

const MAX_PRESETS = 30;
const MAX_NAME_LENGTH = 24;

/** 解析导入或存储的预设数组；坏条目丢掉，不牵连其它条目 */
export function parsePresets(raw: unknown): CustomPreset[] {
  if (!Array.isArray(raw)) return [];

  const parsed: CustomPreset[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const entry = item as Record<string, unknown>;

    const id = typeof entry.id === 'string' && entry.id.length > 0 ? entry.id : null;
    const name = typeof entry.name === 'string' && entry.name.trim().length > 0 ? entry.name.trim() : null;
    if (!id || !name) continue;

    const params =
      entry.params && typeof entry.params === 'object' && !Array.isArray(entry.params)
        ? (entry.params as Partial<AdvancedParams>)
        : {};

    parsed.push({
      id,
      name: name.slice(0, MAX_NAME_LENGTH),
      params,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
    });
    if (parsed.length >= MAX_PRESETS) break;
  }
  return parsed;
}

/** 导出成带版本号的 JSON，方便以后换格式时认得出来 */
export function exportPresets(presets: CustomPreset[]): string {
  return `${JSON.stringify({ kind: 'ffshift-presets', version: 1, presets }, null, 2)}\n`;
}

export interface ImportResult {
  presets: CustomPreset[];
  /** 新导入的条数 */
  added: number;
  /** 因格式问题被丢掉的条数 */
  skipped: number;
}

/**
 * 从 JSON 文本导入。
 * 同名的不重复导入（免得反复点就攒出一堆"我的预设 2"），
 * 数量超上限时只收前面的。
 */
export function importPresets(raw: string, existing: CustomPreset[]): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { presets: existing, added: 0, skipped: 0 };
  }

  const incoming = parsePresets(
    Array.isArray(data) ? data : ((data as { presets?: unknown } | null)?.presets ?? null),
  );
  if (incoming.length === 0) return { presets: existing, added: 0, skipped: 0 };

  const names = new Set(existing.map((preset) => preset.name));
  const fresh = incoming.filter((preset) => {
    if (names.has(preset.name)) return false;
    names.add(preset.name);
    return true;
  });

  const room = Math.max(0, MAX_PRESETS - existing.length);
  const accepted = fresh.slice(0, room);

  return {
    presets: [...existing, ...accepted],
    added: accepted.length,
    skipped: incoming.length - accepted.length,
  };
}

/** 新建一条用户预设；重名时自动加序号，免得攒出一堆同名的分不清 */
export function createPreset(name: string, params: AdvancedParams, existing: CustomPreset[]): CustomPreset {
  const base = name.trim().slice(0, MAX_NAME_LENGTH) || '未命名预设';

  const taken = new Set(existing.map((preset) => preset.name));
  let finalName = base;
  let index = 2;
  while (taken.has(finalName)) {
    finalName = `${base} ${index}`.slice(0, MAX_NAME_LENGTH);
    index += 1;
  }

  return {
    id: `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: finalName,
    // 只存与默认不同的字段，存储与导出都干净
    params: Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== null),
    ) as Partial<AdvancedParams>,
    createdAt: new Date().toISOString(),
  };
}

export { MAX_PRESETS };
