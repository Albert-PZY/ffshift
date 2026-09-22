#!/usr/bin/env node
/**
 * 安装 FFShift 的 git hooks（一次性）。
 * 作用：把仓库的 core.hooksPath 指向 .githooks，并探测 node 路径。
 * 用法：node scripts/install-hooks.mjs
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const hooksDir = join(root, '.githooks');

function sh(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

if (!existsSync(hooksDir)) {
  console.error(`找不到 hooks 目录：${hooksDir}`);
  process.exit(1);
}

sh(['config', 'core.hooksPath', '.githooks']);
console.log('✓ core.hooksPath → .githooks');

// 记录当前 node 的绝对路径，供 hook 在 PATH 不完整时兜底
mkdirSync(hooksDir, { recursive: true });
writeFileSync(join(hooksDir, '.node-path'), `${process.execPath}\n`, 'utf8');
console.log(`✓ 记录 node 路径：${process.execPath}`);

const hooks = ['pre-commit', 'commit-msg', 'pre-push', 'post-commit'];
console.log(`✓ 已启用：${hooks.join(', ')}`);
console.log('\n提示：主分支保护已在本机生效——main 上无法直接提交，必须从其它分支合并。');
