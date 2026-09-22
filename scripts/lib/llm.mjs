/**
 * 最小 OpenAI 兼容客户端（零依赖，只用 Node 内置 fetch）。
 * Key 只从环境变量读，绝不落盘、绝不打印。
 */
import { execFileSync } from 'node:child_process';

export function resolveKey(envName = 'WORKBUDDY_API_KEY') {
  if (process.env[envName]) return process.env[envName];
  // 当前进程没继承到环境变量时，去 Windows 用户级环境变量取
  if (process.platform === 'win32') {
    try {
      const out = execFileSync(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command', `[Environment]::GetEnvironmentVariable('${envName}','User')`],
        { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim();
      if (out) return out;
    } catch {
      /* 忽略：交给调用方判断 */
    }
  }
  return null;
}

/**
 * 调一次 chat completions。
 * @returns {Promise<{content: string, model: string, usage: object}>}
 */
export async function chat({ system, user, ai = {} }) {
  const envName = ai.keyEnv ?? 'WORKBUDDY_API_KEY';
  const key = resolveKey(envName);
  if (!key) throw new Error(`缺少 API Key：环境变量 ${envName} 未设置`);

  const baseUrl = (ai.baseUrl ?? 'https://wb.albert-go.top/v1').replace(/\/$/, '');
  const model = ai.model ?? 'global:fast-model';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ai.timeoutMs ?? 90000);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: ai.maxTokens ?? 1200,
        stream: false,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    return { content, model: data?.model ?? model, usage: data?.usage ?? {} };
  } finally {
    clearTimeout(timer);
  }
}

/** 从模型输出里抠出 JSON（容忍 ```json 包裹与前后废话）。 */
export function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
