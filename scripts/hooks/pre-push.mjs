#!/usr/bin/env node
/**
 * pre-push：禁止直接推送受保护分支。主分支只能通过 PR 合并更新。
 * stdin 每行：<local ref> <local sha> <remote ref> <remote sha>
 */
import { config, ok, fail, info, title } from '../lib/env.mjs';

const ZERO = /^0{40}$|^0{64}$/;

const cfg = config();
const protectedBranches = cfg.branchPolicy?.protected ?? ['main'];
const allow = process.env.FFSHIFT_ALLOW_MAIN_PUSH === '1';

const input = await new Promise((resolve) => {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (buf += c));
  process.stdin.on('end', () => resolve(buf));
});

const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
const blocked = [];

for (const line of lines) {
  const [, , remoteRef, remoteSha] = line.split(/\s+/);
  if (!remoteRef) continue;
  const isDelete = ZERO.test(remoteSha ?? '');
  const isProtected = protectedBranches.some((b) => remoteRef === `refs/heads/${b}`);
  if (isProtected && !isDelete) blocked.push(remoteRef);
}

title('FFShift · pre-push');

if (blocked.length && cfg.branchPolicy?.blockDirectPush !== false && !allow) {
  fail(`禁止直接推送：${blocked.join(', ')}`);
  console.log('   → 推功能分支：git push -u origin feat/media-probe');
  console.log('   → 在 GitHub 开 PR，合并进 main');
  console.log('   → 本地同步：git switch main && git pull --ff-only');
  console.log('   （确需放行时设 FFSHIFT_ALLOW_MAIN_PUSH=1，仅限紧急）');
  process.exit(1);
}

info(`推送 ${lines.length} 个 ref`);
ok('推送检查通过');
