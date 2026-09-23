#!/usr/bin/env node
/**
 * pre-push：两件事。
 *   1. 禁止直接推送受保护分支——主分支只能通过 PR 合并更新；
 *   2. 推送前跑端到端测试——它是唯一能证明"界面上点一下整条链路真的通"的关卡，
 *      放在提交前太重（一条要 30 秒且需要先构建），放在推送前正合适。
 * stdin 每行：<local ref> <local sha> <remote ref> <remote sha>
 */
import { spawnSync } from 'node:child_process';
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

// 端到端测试：唯一能证明"界面上点一下，整条链路真的通"的关卡。
// 它要 30 秒上下并且会先构建，所以放推送前，不放提交前。
if (process.env.FFSHIFT_SKIP_E2E === '1') {
  info('已跳过端到端测试（FFSHIFT_SKIP_E2E=1）');
} else if (cfg.pipeline?.e2eOnPush === false) {
  info('已跳过端到端测试（.ffshift/config.json 里关掉了）');
} else {
  info('跑端到端测试：驱动真实界面，约 40 秒（赶时间可设 FFSHIFT_SKIP_E2E=1）');

  const result = spawnSync('npm', ['run', 'test:e2e'], {
    stdio: 'inherit',
    // Windows 上 npm 是 .cmd，不加 shell 会报 EINVAL
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    fail('端到端测试未通过，本次推送被拦下');
    console.log('   → 看完整输出：npm run test:e2e');
    console.log('   → 常见原因：界面文案或结构改了，选择器没跟着改');
    console.log('   → 确需放行时设 FFSHIFT_SKIP_E2E=1（不建议，等于放弃这道关）');
    process.exit(1);
  }
  ok('端到端测试通过');
}

ok('推送检查通过');
