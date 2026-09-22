#!/usr/bin/env node
/**
 * pre-commit：提交前的确定性检查（毫秒级、不联网）。
 * 1) 保护分支不可直接提交  2) 禁提交路径  3) 大文件  4) 密钥泄露  5) 空白与冲突标记
 */
import { statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { git, branch, stagedFiles, showStaged, mergeOrRebaseInProgress, hasCommits } from '../lib/git.mjs';
import { config, ok, fail, warn, info, title, allowProtectedCommit } from '../lib/env.mjs';
import { lintFiles } from '../lib/oil-tone.mjs';

const cfg = config();
const errors = [];
const warnings = [];
const hints = [];

const currentBranch = branch();
const protectedBranches = cfg.branchPolicy?.protected ?? ['main'];
const blockedPaths = cfg.precommit?.blockedPathPatterns ?? [];
const maxMiB = cfg.precommit?.maxFileMiB ?? 50;
const warnMiB = cfg.precommit?.warnFileMiB ?? 10;

title('FFShift · pre-commit');

// 1) 保护分支
if (protectedBranches.includes(currentBranch) && cfg.branchPolicy?.blockDirectCommit !== false) {
  if (!mergeOrRebaseInProgress() && !allowProtectedCommit() && hasCommits()) {
    errors.push(
      `${currentBranch} 是受保护分支，禁止直接提交。\n` +
        `   → 先切功能分支：git switch -c feat/media-probe\n` +
        `   → 合并类提交（merge/rebase）会自动放行`,
    );
  } else if (!hasCommits()) {
    info('初始提交：本次放行，之后 main 将禁止直接提交。');
  }
}

const files = stagedFiles();
info(`暂存文件 ${files.length} 个`);

// 1.5) 分支命名：按模块开分支是规范的一部分，不能只写在文档里
const prefixes = cfg.branchPolicy?.allowedPrefixes ?? [];
if (
  prefixes.length &&
  !protectedBranches.includes(currentBranch) &&
  currentBranch !== '(detached)' &&
  !prefixes.some((p) => currentBranch.startsWith(p))
) {
  errors.push(
    `分支名 "${currentBranch}" 不符合规范。\n` +
      `   → 应以这些前缀开头：${prefixes.join('  ')}\n` +
      `   → 例：git switch -c feat/media-probe（模块名取自提交 area 表）`,
  );
}

const TEXT_EXT = /\.(ts|tsx|js|mjs|cjs|jsx|json|ya?ml|md|ps1|sh|bat|cmd|css|html|txt|env|toml|ini)$/i;
const SKIP_SECRET_FILE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml)$/;

const SECRETS = [
  { name: '疑似 API Key（sk- 前缀）', re: /\bsk-[A-Za-z0-9_-]{16,}/ },
  {
    name: '疑似密钥赋值',
    re: /(api[_-]?key|apikey|access[_-]?token|secret[_-]?key|password)\s*[:=]\s*["'`][A-Za-z0-9_\-/+=]{16,}["'`]/i,
  },
  { name: '疑似 Bearer Token', re: /Bearer\s+[A-Za-z0-9_\-.]{20,}/ },
  { name: '疑似私钥文件', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];
const PLACEHOLDER = /(example|your[-_]?key|your[-_]?token|placeholder|redacted|xxx+|<[^>]+>|\$\{)/i;

for (const f of files) {
  // 2) 禁提交路径
  if (blockedPaths.some((p) => f.startsWith(p) || f.includes(`/${p}`))) {
    errors.push(`禁提交路径：${f}（见 .ffshift/config.json precommit.blockedPathPatterns）`);
    continue;
  }

  // 3) 大文件（按暂存对象大小，不是工作区）
  const sizeStr = git(['cat-file', '-s', `:${f}`], { allowFail: true });
  const size = sizeStr ? Number(sizeStr) : 0;
  if (size > maxMiB * 1024 * 1024) {
    errors.push(`${f} 体积 ${(size / 1048576).toFixed(1)} MiB，超过 ${maxMiB} MiB 上限（GitHub 100 MiB 直接拒收，大二进制请走 Release）。`);
  } else if (size > warnMiB * 1024 * 1024) {
    warnings.push(`${f} 体积 ${(size / 1048576).toFixed(1)} MiB，偏大——确认它真的需要进仓库。`);
  }

  // 4) 密钥泄露
  if (!TEXT_EXT.test(f) || SKIP_SECRET_FILE.test(f)) continue;
  const content = showStaged(f);
  if (content === null) continue;
  const lines = content.split('\n');
  for (const { name, re } of SECRETS) {
    const hitIndex = lines.findIndex((l) => re.test(l) && !PLACEHOLDER.test(l));
    if (hitIndex >= 0) {
      errors.push(`${name} 泄漏在 ${f}:${hitIndex + 1} → 密钥只放本机环境变量，不要入库。`);
    }
  }
  if (/^<<<<<<< |^=======$|^>>>>>>> /m.test(content)) {
    errors.push(`未解决的冲突标记留在 ${f} 里。`);
  }
}

// 5) 空白错误（git 口径；Markdown 的尾随空格是合法硬换行，故只提示）
const check = git(['diff', '--cached', '--check'], { allowFail: true });
if (check && check.trim()) {
  warnings.push(`git diff --check 报出空白问题（常见于行尾空格）：\n${check.trim().split('\n').slice(0, 5).join('\n')}`);
}

// 6) oil-tone 文风检查：只查暂存的 Markdown，skill 不在本机就跳过
const mdFiles = files.filter((f) => f.toLowerCase().endsWith('.md'));
if (mdFiles.length) {
  const lint = lintFiles(mdFiles);
  if (!lint.available) {
    hints.push(`文风检查跳过：${lint.reason}`);
  } else {
    for (const f of lint.fails) {
      errors.push(`${f.file}:${f.line} 命中 oil-tone FAIL → ${f.fix}\n   原文：${f.text.slice(0, 60)}`);
    }
    for (const f of lint.warns.slice(0, 5)) {
      warnings.push(`${f.file}:${f.line} oil-tone 提示 → ${f.fix}`);
    }
  }
}

// 报告
for (const e of errors) fail(e.split('\n')[0]) || console.log(`   ${e.split('\n').slice(1).join('\n   ')}`);
for (const w of warnings) warn(w);
for (const h of hints) info(h);

if (errors.length) {
  console.log(`\n${errors.length} 个问题阻止了本次提交。规则见 docs/git-workflow.md。`);
  console.log('确实需要绕过时用 git commit --no-verify（不建议，面试会看提交历史）。');
  process.exit(1);
}
ok('检查通过');
