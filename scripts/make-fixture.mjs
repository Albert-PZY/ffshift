#!/usr/bin/env node
/**
 * 生成测试素材（不需要下载任何东西）。
 *   node scripts/make-fixture.mjs [输出目录]
 * 默认写到系统临时目录，并在 stdout 打印路径，方便脚本串联。
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const outDir = process.argv[2] ?? join(tmpdir(), 'ffshift-fixtures');
mkdirSync(outDir, { recursive: true });

const target = join(outDir, '素材 样本.mp4');

execFileSync(
  'ffmpeg',
  [
    '-hide_banner', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440',
    '-t', '5',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    target,
  ],
  { stdio: 'inherit' },
);

console.log(target);
