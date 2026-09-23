#!/usr/bin/env node
/**
 * 把 ffmpeg / ffprobe 准备到 resources/ffmpeg/，供打包时随包分发。
 *   node scripts/prepare-ffmpeg.mjs [源目录]
 *
 * 优先级：命令行参数 → FFSHIFT_FFMPEG_DIR → 系统 PATH 里的 ffmpeg 所在目录。
 * 二进制不进仓库（单个约 100 MB），只在这里按需复制。
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targetDir = join(rootDir, 'resources', 'ffmpeg');
const isWindows = process.platform === 'win32';
const names = isWindows ? ['ffmpeg.exe', 'ffprobe.exe'] : ['ffmpeg', 'ffprobe'];

/** 从 PATH 里找 ffmpeg 的位置；找不到返回 null。 */
function directoryFromPath() {
  try {
    const probe = isWindows ? 'where.exe' : 'which';
    const output = execFileSync(probe, ['ffmpeg'], { encoding: 'utf8' });
    const first = output.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
    return first ? dirname(first) : null;
  } catch {
    return null;
  }
}

const sourceDir = process.argv[2] ?? process.env.FFSHIFT_FFMPEG_DIR ?? directoryFromPath();

if (!sourceDir) {
  console.error('找不到 ffmpeg：请用参数指定目录，或设置 FFSHIFT_FFMPEG_DIR，或确保它在 PATH 里。');
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

let totalBytes = 0;
for (const name of names) {
  const source = join(sourceDir, name);
  if (!existsSync(source)) {
    console.error(`源目录里没有 ${name}：${sourceDir}`);
    process.exit(1);
  }
  const target = join(targetDir, name);
  copyFileSync(source, target);
  const size = statSync(target).size;
  totalBytes += size;
  console.log(`✓ ${name}  ${(size / 1024 / 1024).toFixed(1)} MB`);
}

// 版本号写进文件，方便排查"包里到底是哪一版"
try {
  const version = execFileSync(join(targetDir, names[0]), ['-version'], { encoding: 'utf8' })
    .split('\n')[0]
    ?.trim();
  console.log(`\n随包版本：${version ?? '未知'}`);
} catch {
  console.warn('\n无法读取版本号（二进制可能不可执行）');
}

console.log(`共 ${(totalBytes / 1024 / 1024).toFixed(1)} MB → resources/ffmpeg/`);
