/**
 * 输出与配置：hook 脚本共用的最小工具。
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './git.mjs';

const C = {
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  dim: '\u001b[2m',
  bold: '\u001b[1m',
  reset: '\u001b[0m',
};

const paint = (color, s) => `${color}${s}${C.reset}`;

export const ok = (s) => console.log(`${paint(C.green, '✓')} ${s}`);
export const fail = (s) => console.log(`${paint(C.red, '✗')} ${s}`);
export const warn = (s) => console.log(`${paint(C.yellow, '⚠')} ${s}`);
export const info = (s) => console.log(`${paint(C.dim, s)}`);
export const title = (s) => console.log(`\n${paint(C.bold, s)}`);

let cached = null;
export function config() {
  if (cached) return cached;
  const path = join(root(), '.ffshift', 'config.json');
  cached = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  return cached;
}

/** 保护分支上"正当提交"的例外：合并 / rebase / 显式放行（首次初始化、无网环境）。 */
export const allowProtectedCommit = () =>
  process.env.FFSHIFT_ALLOW_MAIN_COMMIT === '1' || process.env.FFSHIFT_ALLOW_MAIN_PUSH === '1';
