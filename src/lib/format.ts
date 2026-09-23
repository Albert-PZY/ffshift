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
