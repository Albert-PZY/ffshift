/**
 * 数值与时间格式化：界面只显示人能扫读的数字。
 * 规则：非法输入一律给占位符（—），绝不把 NaN、Infinity 漏到界面上。
 */

const PLACEHOLDER = '—';
const BYTE_UNITS = ['B', 'KiB', 'MiB', 'GiB', 'TiB'] as const;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return PLACEHOLDER;
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return PLACEHOLDER;

  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return PLACEHOLDER;

  const clamped = Math.min(1, Math.max(0, ratio));
  const percent = clamped * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

export function formatSpeed(speed: number): string {
  if (!Number.isFinite(speed) || speed <= 0) return PLACEHOLDER;

  const fixed = speed.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${fixed}x`;
}

export function formatRemaining(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return PLACEHOLDER;
  if (seconds < 60) return `约 ${Math.ceil(seconds)} 秒`;
  if (seconds < 3600) return `约 ${Math.ceil(seconds / 60)} 分`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `约 ${hours} 小时 ${minutes} 分` : `约 ${hours} 小时`;
}

/**
 * 体积对比：源 → 产物，带增减百分比。
 *
 * 数据不全（还没转换完、源文件大小读不出来）时返回 null，界面显示占位符——
 * 算不出百分比不代表没变化，用 0% 表示等于撒谎。
 */
export function formatSizeChange(inputBytes: number, outputBytes: number | null): string | null {
  if (outputBytes === null || !Number.isFinite(outputBytes) || outputBytes <= 0) return null;
  if (!Number.isFinite(inputBytes) || inputBytes <= 0) return null;

  const delta = Math.round(((outputBytes - inputBytes) / inputBytes) * 100);
  const sign = delta > 0 ? '+' : '';
  return `${formatBytes(inputBytes)} → ${formatBytes(outputBytes)}（${sign}${delta}%）`;
}

/** 只要增减百分比那一段，历史行用它，省得每行都重复一遍两个绝对值 */
export function formatSizeDelta(inputBytes: number, outputBytes: number | null): string | null {
  if (outputBytes === null || !Number.isFinite(outputBytes) || outputBytes <= 0) return null;
  if (!Number.isFinite(inputBytes) || inputBytes <= 0) return null;

  const delta = Math.round(((outputBytes - inputBytes) / inputBytes) * 100);
  return `${delta > 0 ? '+' : ''}${delta}%`;
}
