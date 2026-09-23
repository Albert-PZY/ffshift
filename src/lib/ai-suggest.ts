/**
 * AI 参数助手：把"一句话需求"变成档位建议。
 *
 * 安全边界（ADR-005）：模型只能输出白名单字段（preset / targetSizeMiB / reason），
 * 任何命令行参数都不接受；解析失败、没 Key、超时，一律退回本地规则引擎。
 * 这一层是纯函数，模型调用在主进程里另做。
 */
import type { Preset } from './ffmpeg-args';

export interface ParsedSuggestion {
  preset: Preset;
  targetSizeMiB: number | null;
  reason: string;
  /** 模型没按 JSON 输出时，从它的自然语言回答里提取出来的 */
  viaProse?: boolean;
}

export interface Suggestion extends ParsedSuggestion {
  /** 建议是模型给的还是本地规则给的，界面必须如实告诉用户 */
  source: 'ai' | 'rules';
}

const PRESETS: readonly Preset[] = ['clear', 'balanced', 'small'];
const MAX_TARGET_MIB = 10_000;
const MAX_REASON_CHARS = 60;

export function suggestionSystemPrompt(): string {
  return [
    '你是视频转换参数助手。用户会用一句话描述用途，你只能从三个档位里选一个：',
    '- "clear"（更清晰）：存档、以后还要再剪辑',
    '- "balanced"（均衡）：日常使用，看不出来差别但体积更小',
    '- "small"（更小）：发微信、发手机、省空间',
    '',
    '规则：',
    '1. 只输出一行 JSON，不要输出任何其它文字、标题、表格或解释。',
    '2. 不要反问用户，不要要求补充信息。信息不全时按最常见的场景给建议。',
    '3. 只允许这三个字段：preset、targetSizeMiB、reason。不要输出命令行参数。',
    '4. 用户提到具体体积时填 targetSizeMiB（单位 MiB），否则填 null。',
    '',
    '示例：',
    '输入：压到 50MB 发微信',
    '输出：{"preset":"small","targetSizeMiB":50,"reason":"微信发送有体积上限，用更小档"}',
    '输入：留着自己以后剪辑',
    '输出：{"preset":"clear","targetSizeMiB":null,"reason":"要再剪辑，保留画质"}',
  ].join('\n');
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    const parsed: unknown = JSON.parse(candidate.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeTarget(value: unknown): number | null {
  const numeric =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) return null;

  const rounded = Math.round(numeric);
  if (rounded < 1 || rounded > MAX_TARGET_MIB) return null;
  return rounded;
}

/** 解析模型输出；不符合白名单就返回 null，由调用方决定降级。 */
export function parseSuggestion(raw: string, userInput = ''): ParsedSuggestion | null {
  const json = extractJsonObject(raw);
  if (json) {
    const preset = json.preset;
    if (typeof preset === 'string' && PRESETS.includes(preset as Preset)) {
      return {
        preset: preset as Preset,
        targetSizeMiB: normalizeTarget(json.targetSizeMiB) ?? extractTargetFromText(userInput),
        reason: typeof json.reason === 'string' ? json.reason.trim().slice(0, MAX_REASON_CHARS) : '',
      };
    }
    // JSON 里 preset 不合法：不猜，交给下面的散文提取
  }

  return extractFromProse(raw, userInput);
}

/**
 * 从模型的自然语言回答里提取要点。
 *
 * 为什么需要这一步：实测网关上的模型经常不理会"只输出 JSON"，
 * 而是回一整段分析（还反问用户要更多信息）。直接丢掉太浪费，
 * 但也不能全信——只认明确的档位倾向词和体积数字，认不出来宁愿返回 null。
 *
 * 体积数字优先取用户自己说的那个：模型回答里常有"微信限制 100MB"这类
 * 它自己的分析数字，拿来当目标体积就错了。
 */
function extractFromProse(text: string, userInput = ''): ParsedSuggestion | null {
  if (!text || text.length < 4) return null;

  const target = extractTargetFromText(userInput) ?? extractTargetFromText(text);
  const wantsSmall = /更小档|用更小|压到|压缩到|省空间|发微信|微信发送|手机上|体积上限/.test(text);
  const wantsClear = /更清晰|保留画质|画质优先|存档|再剪辑|高码率|不压缩/.test(text);

  if (wantsSmall && wantsClear) {
    return target === null
      ? { preset: 'balanced', targetSizeMiB: null, reason: '既要体积又要画质，取均衡档', viaProse: true }
      : { preset: 'small', targetSizeMiB: target, reason: '按体积上限压，用更小档', viaProse: true };
  }
  if (wantsSmall) {
    return { preset: 'small', targetSizeMiB: target, reason: '要发给手机或微信，用更小档', viaProse: true };
  }
  if (wantsClear) {
    return { preset: 'clear', targetSizeMiB: target, reason: '要保留画质，用更清晰档', viaProse: true };
  }
  return null;
}

function extractTargetFromText(text: string): number | null {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(mb|mib|兆)/i);
  const value = match?.[1] ? Number(match[1]) : Number.NaN;
  if (!Number.isFinite(value) || value < 1 || value > MAX_TARGET_MIB) return null;
  return Math.round(value);
}

/**
 * 规则引擎：模型不可用时的退路。
 * 只认几个明确意图，认不出来就给均衡档，并说明这是默认值。
 */
export function fallbackSuggestion(description: string): Suggestion {
  const text = description.toLowerCase();
  const target = extractTargetFromText(text);

  if (/微信|手机|朋友圈|省空间|压小|压到|压缩|小一点/.test(text)) {
    return {
      preset: 'small',
      targetSizeMiB: target,
      reason: target === null ? '要发给手机或微信，选更小档' : '按你说的体积上限，选更小档',
      source: 'rules',
    };
  }

  if (/存档|剪辑|清晰|画质|保留|高一点/.test(text)) {
    return {
      preset: 'clear',
      targetSizeMiB: target,
      reason: '要存档或再剪辑，选更清晰档',
      source: 'rules',
    };
  }

  return {
    preset: 'balanced',
    targetSizeMiB: target,
    reason: '没看出特别偏好，用默认的均衡档',
    source: 'rules',
  };
}

const PRESET_LABEL: Record<Preset, string> = {
  clear: '更清晰',
  balanced: '均衡',
  small: '更小',
};

export function describeSuggestion(suggestion: Suggestion): string {
  const parts = [`建议用「${PRESET_LABEL[suggestion.preset]}」档`];
  if (suggestion.targetSizeMiB !== null) {
    parts.push(`目标体积 ${suggestion.targetSizeMiB} MiB`);
  }
  if (suggestion.reason) parts.push(suggestion.reason);
  return parts.join('，');
}
