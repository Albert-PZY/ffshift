#!/usr/bin/env node
/**
 * hooks 冒烟验证：在一个临时仓库里真跑一遍，确认拦截和放行都对。
 *   node scripts/verify-hooks.mjs
 * 不碰主仓库，跑完自动清理。
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = mkdtempSync(join(tmpdir(), 'ffshift-verify-'));

let passed = 0;
let failed = 0;
const results = [];

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    results.push(`  ✓ ${name}`);
  } else {
    failed++;
    results.push(`  ✗ ${name}${detail ? `\n      ${detail.split('\n').slice(0, 8).join('\n      ')}` : ''}`);
  }
}

function gitRun(args) {
  const r = spawnSync('git', args, { cwd: sandbox, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function nodeRun(script, args = [], input = undefined) {
  const r = spawnSync(process.execPath, [join(sandbox, script), ...args], {
    cwd: sandbox,
    encoding: 'utf8',
    input,
  });
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function writeMsg(name, text) {
  const p = join(sandbox, '.msg', name);
  mkdirSync(join(sandbox, '.msg'), { recursive: true });
  writeFileSync(p, text, 'utf8');
  return p;
}

const commit = (msgFile) => gitRun(['-c', 'i18n.commitEncoding=UTF-8', 'commit', '-F', msgFile, '--no-gpg-sign']);

// ── 沙箱搭建 ────────────────────────────────────────────────────────────────
console.log(`\nFFShift · hooks 冒烟验证（沙箱 ${sandbox}）\n`);
cpSync(join(projectRoot, '.githooks'), join(sandbox, '.githooks'), { recursive: true });
cpSync(join(projectRoot, 'scripts'), join(sandbox, 'scripts'), { recursive: true });
mkdirSync(join(sandbox, '.ffshift'), { recursive: true });
mkdirSync(join(sandbox, 'docs'), { recursive: true });

const cfg = JSON.parse(readFileSync(join(projectRoot, '.ffshift', 'config.json'), 'utf8'));
cfg.docs.aiDraft = false; // 测试不调 AI：既省钱也避免阻塞
cfg.precommit.maxFileMiB = 1; // 便于用小文件验证大文件拦截
writeFileSync(join(sandbox, '.ffshift', 'config.json'), JSON.stringify(cfg, null, 2), 'utf8');

writeFileSync(join(sandbox, 'docs', 'ai-session-log.md'), '# AI 协作会话总结 · 沙箱\n\n## 开发阶段待办\n\n- 无\n', 'utf8');
writeFileSync(join(sandbox, 'docs', 'testing.md'), '# 测试清单\n\n## 5. 开发期记录\n\n| 日期 | 提交 | 范围 | 结果 |\n| --- | --- | --- | --- |\n| — | — | — | 待开发阶段填写 |\n', 'utf8');
writeFileSync(join(sandbox, 'docs', 'writing-style.md'), '# 文案契约\n\n短句、具体、不空话。\n', 'utf8');

gitRun(['init', '-b', 'main']);
gitRun(['config', 'user.name', 'sandbox']);
gitRun(['config', 'user.email', 'sandbox@example.com']);
gitRun(['config', 'core.hooksPath', '.githooks']);
gitRun(['config', 'commit.gpgsign', 'false']);
check('沙箱仓库已就绪', gitRun(['rev-parse', '--git-dir']).code === 0);

// ── 1. 建功能分支 + 脚手架首次提交 ──────────────────────────────────────────
gitRun(['switch', '-c', 'feat/cli-skeleton']);
writeFileSync(join(sandbox, 'app.txt'), 'hello\n', 'utf8');
gitRun(['add', '-A']);
let r = commit(
  writeMsg(
    'ok.txt',
    'lib: 建立参数构造的纯函数骨架\n\n转换参数原本散在各处，改动容易漏掉校验。\n先抽出纯函数并留出入口，后续预设都走这里。\n\n验证：node 直接跑一遍构造，参数数组正确\n',
  ),
);
check('① 分支 + 规范信息 → 放行', r.code === 0, r.out);

// ── 2. 主分支保护 ───────────────────────────────────────────────────────────
gitRun(['branch', 'main']);
gitRun(['switch', 'main']);
writeFileSync(join(sandbox, 'app.txt'), 'hello main\n', 'utf8');
gitRun(['add', 'app.txt']);
r = commit(writeMsg('main.txt', 'chore: 直接改主分支\n\n这是不该发生的提交，应该被拦住。\n'));
check('② main 上直接提交 → 拦截', r.code !== 0 && /禁止直接提交/.test(r.out), r.out);

// 清掉被拦截的改动，回到功能分支继续
gitRun(['reset', '--hard', 'HEAD']);
gitRun(['clean', '-fdq']);

// ── 3. 提交信息校验 ─────────────────────────────────────────────────────────
gitRun(['switch', 'feat/cli-skeleton']);

const badMsgs = [
  ['③ 无 area 前缀 → 拦截', '加了一个功能\n\n说明为什么改这一块，写点具体原因。\n'],
  ['④ area 不在白名单 → 拦截', 'video: 改了点东西\n\n说明为什么改这一块，写点具体原因。\n'],
  ['⑤ 正文空话 → 拦截', 'ui: 调整空态文案\n\n优化了性能，提升了体验，完善了功能。\n'],
  ['⑥ 无正文 → 拦截', 'ui: 调整空态文案\n'],
  ['⑦ 首行过去式 → 拦截（过去式只警告，这里验证格式错）', 'ui: 修复了空态文案。\n\n说明为什么改这一块，写点具体原因。\n'],
];

for (const [name, msg] of badMsgs.slice(0, 4)) {
  writeFileSync(join(sandbox, 'app.txt'), `x${Math.random()}\n`, 'utf8');
  gitRun(['add', 'app.txt']);
  r = commit(writeMsg(`bad-${Math.random().toString(36).slice(2)}.txt`, msg));
  check(name, r.code !== 0, r.out);
}

// 过去式 + 句号：句号是错误，过去式是警告 → 仍应拦截
writeFileSync(join(sandbox, 'app.txt'), `y${Math.random()}\n`, 'utf8');
gitRun(['add', 'app.txt']);
r = commit(writeMsg('past.txt', 'ui: 修复了空态文案。\n\n说明为什么改这一块，写点具体原因。\n'));
check('⑦ 首行带句号（并提示过去式）→ 拦截', r.code !== 0 && /不要加句号/.test(r.out) && /祈使句/.test(r.out), r.out);

// ── 4. 密钥与体积 ───────────────────────────────────────────────────────────
// 样例 key 拆开拼接：避免本文件自己被密钥扫描拦住（扫描器不该为此放松规则）
const fakeKey = ['sk', '-abcdefghijklmnopqrstuvwxyz012345'].join('');
writeFileSync(join(sandbox, 'config.local.mjs'), `export const key = "${fakeKey}";\n`, 'utf8');
gitRun(['add', 'config.local.mjs']);
r = commit(writeMsg('secret.txt', 'build: 增加本地配置模板\n\n把模板文件提交进仓库，方便其他人复制。\n'));
check('⑧ 提交含密钥 → 拦截', r.code !== 0 && /疑似/.test(r.out), r.out);
gitRun(['rm', '--cached', '-q', '--ignore-unmatch', 'config.local.mjs']);
rmSync(join(sandbox, 'config.local.mjs'), { force: true });

writeFileSync(join(sandbox, 'big.bin'), Buffer.alloc(1.5 * 1024 * 1024, 7));
gitRun(['add', 'big.bin']);
r = commit(writeMsg('big.txt', 'build: 加入体积测试文件\n\n验证大文件拦截是否生效，这个文件应当被拒。\n'));
check('⑨ 超过体积上限 → 拦截', r.code !== 0 && /MiB/.test(r.out), r.out);
gitRun(['rm', '--cached', '-q', '--ignore-unmatch', 'big.bin']);
rmSync(join(sandbox, 'big.bin'), { force: true });

// ── 5. 成功路径 + 沉淀 ──────────────────────────────────────────────────────
writeFileSync(join(sandbox, 'app.txt'), 'final\n', 'utf8');
gitRun(['add', 'app.txt']);
r = commit(writeMsg('good.txt', 'ui: 空态改为一句话加一个动作\n\n空态原本只有一句"暂无数据"，用户不知道该做什么。\n改成一句说明 + 一个主按钮，文案与 docs/writing-style.md 对齐。\n\n验证：手动走一遍空态，按钮路径可达\n'));
check('⑩ 规范提交 → 放行', r.code === 0, r.out);

r = nodeRun('scripts/sync-docs.mjs');
const logText = readFileSync(join(sandbox, 'docs', 'ai-session-log.md'), 'utf8');
check('⑪ 提交后自动写提交流水', /## 提交流水（自动生成）/.test(logText) && /ui: 空态改为一句话加一个动作/.test(logText), r.out);
const statusPath = join(sandbox, 'docs', 'project-status.md');
check('⑫ 生成项目状态页', existsSync(statusPath) && readFileSync(statusPath, 'utf8').includes('项目状态'), r.out);

// 幂等：再跑一次不应重复写（重复运行多少次，流水都只该有一条）
nodeRun('scripts/sync-docs.mjs');
const again = readFileSync(join(sandbox, 'docs', 'ai-session-log.md'), 'utf8');
const rows = (again.match(/ui: 空态改为一句话加一个动作/g) ?? []).length;
check('⑬ 沉淀幂等（重复运行不追加）', rows === 1, `流水行出现 ${rows} 次，应为 1 次`);

// ── 6. 主分支推送保护 ───────────────────────────────────────────────────────
r = nodeRun('scripts/hooks/pre-push.mjs', [], 'refs/heads/main 0000000000000000000000000000000000000000 refs/heads/main 1111111111111111111111111111111111111111\n');
check('⑭ 推送 main → 拦截', r.code !== 0 && /禁止直接推送/.test(r.out), r.out);

r = nodeRun('scripts/hooks/pre-push.mjs', [], 'refs/heads/feat/cli-skeleton 0000000000000000000000000000000000000000 refs/heads/feat/cli-skeleton 1111111111111111111111111111111111111111\n');
check('⑮ 推送功能分支 → 放行', r.code === 0, r.out);

// ── 7. 分支命名 ─────────────────────────────────────────────────────────────
gitRun(['switch', '-c', 'random-branch-name']);
writeFileSync(join(sandbox, 'app.txt'), 'naming\n', 'utf8');
gitRun(['add', 'app.txt']);
r = commit(writeMsg('naming.txt', 'ui: 测试分支命名检查\n\n分支名不合规范时应当被拦住，这是本用例要验证的行为。\n'));
check('⑯ 分支名不合规范 → 拦截', r.code !== 0 && /不符合规范/.test(r.out), r.out);
gitRun(['reset', '--hard', 'HEAD']);
gitRun(['switch', 'feat/cli-skeleton']);
gitRun(['branch', '-D', 'random-branch-name']);

// ── 汇总 ────────────────────────────────────────────────────────────────────
console.log(results.join('\n'));
console.log(`\n通过 ${passed} · 失败 ${failed}\n`);
try {
  rmSync(sandbox, { recursive: true, force: true });
} catch {
  console.log(`（沙箱被后台沉淀进程短暂占用，稍后可手动删除：${sandbox}）`);
}
process.exit(failed ? 1 : 0);
