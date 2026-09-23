#!/usr/bin/env node
/**
 * 把 resources/icon.png 打包成多尺寸 ICO（Windows 打包用）。
 *   node scripts/make-icon.mjs
 * 只做格式封装，不引图像库：ICO 允许直接内嵌 PNG 数据。
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SIZES = [16, 24, 32, 48, 64, 128, 256];
const source = 'resources/icon.png';
const target = 'resources/icon.ico';

const workDir = mkdtempSync(join(tmpdir(), 'ffshift-icon-'));

try {
  const images = SIZES.map((size) => {
    const file = join(workDir, `icon-${size}.png`);
    execFileSync(
      'ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-vf', `scale=${size}:${size}`, file],
      { stdio: 'inherit' },
    );
    return { size, data: readFileSync(file) };
  });

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;

  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // 256 用 0 表示
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // 调色板数
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }

  writeFileSync(target, Buffer.concat([header, ...entries, ...images.map((i) => i.data)]));
  console.log(`${target} 已生成：${images.length} 个尺寸（${SIZES.join('/')}）`);
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
