/**
 * AI 建议的主进程侧：调模型 → 白名单校验 → 失败降级到本地规则。
 *
 * 三条硬约束（ADR-005）：
 *   1. 只用模型输出的 preset / targetSizeMiB / reason，其余字段一律丢弃；
 *   2. Key 只从环境变量读，不落盘、不进日志；
 *   3. 没有 Key、超时、输出不合规，全部退回规则引擎，且如实告诉用户来源。
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  fallbackSuggestion,
  parseSuggestion,
  suggestionSystemPrompt,
  type Suggestion,
} from '../src/lib/ai-suggest';

const execFileAsync = promisify(execFile);

export interface AiSettings {
  baseUrl: string;
  model: string;
  keyEnv: string;
  timeoutMs: number;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  baseUrl: process.env.FFSHIFT_AI_BASE_URL ?? 'https://wb.albert-go.top/v1',
  model: process.env.FFSHIFT_AI_MODEL ?? 'global:fast-model',
  keyEnv: 'WORKBUDDY_API_KEY',
  timeoutMs: 60_000,
};

export interface SuggestionResult {
  suggestion: Suggestion;
  /** 给用户看的一句话：这次建议从哪来 */
  note: string;
}

/** 进程环境里没有就退到 Windows 用户级环境变量。 */
async function resolveKey(envName: string): Promise<string | null> {
  const fromProcess = process.env[envName];
  if (fromProcess) return fromProcess;
  if (process.platform !== 'win32') return null;

  try {
    const { stdout } = await execFileAsync(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', `[Environment]::GetEnvironmentVariable('${envName}','User')`],
      { timeout: 20_000 },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function requestSuggestion(
  description: string,
  settings: AiSettings = DEFAULT_AI_SETTINGS,
): Promise<SuggestionResult> {
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return { suggestion: fallbackSuggestion(''), note: '先写一句你的用途，比如「压到 50MB 发微信」' };
  }

  const key = await resolveKey(settings.keyEnv);
  if (!key) {
    return { suggestion: fallbackSuggestion(trimmed), note: '没有读到 API Key，用的是本地规则' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
    let content = '';

    try {
      const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: 'system', content: suggestionSystemPrompt() },
            { role: 'user', content: trimmed },
          ],
          max_tokens: 300,
          stream: false,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      content = data.choices?.[0]?.message?.content ?? '';
    } finally {
      clearTimeout(timer);
    }

    const parsed = parseSuggestion(content, trimmed);
    if (!parsed) {
      return { suggestion: fallbackSuggestion(trimmed), note: '模型输出里没有可用信息，已改用本地规则' };
    }
    return {
      suggestion: {
        preset: parsed.preset,
        targetSizeMiB: parsed.targetSizeMiB,
        reason: parsed.reason,
        source: 'ai',
      },
      note: parsed.viaProse ? '模型没按格式答，已从回答里提取要点' : '由模型给出',
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { suggestion: fallbackSuggestion(trimmed), note: `模型不可用（${reason}），已改用本地规则` };
  }
}
