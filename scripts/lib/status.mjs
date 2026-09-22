/**
 * 项目状态采集：全部是确定性数据（提交数、文件、spec 目录、测试表），不调 AI、不猜测。
 * 输出给 docs/project-status.md，让"项目信息密度"可随时被审阅。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { git, root } from './git.mjs';

const readIfExists = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

function listDirs(p) {
  if (!existsSync(p)) return [];
  return readdirSync(p, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/** 各模块最近一次改动时间与提交数。 */
function moduleStats(rootDir) {
  const featuresDir = join(rootDir, 'src', 'features');
  const mods = listDirs(featuresDir);
  if (!mods.length) return [];
  return mods.map((m) => {
    const rel = `src/features/${m}`;
    const count = git(['rev-list', '--count', 'HEAD', '--', rel], { allowFail: true }) ?? '0';
    const last = git(['log', '-1', '--date=short', '--pretty=%ad', '--', rel], { allowFail: true }) ?? '—';
    return { name: m, commits: Number(count), last };
  });
}

/** docs/testing.md 里的冒烟清单统计。 */
function smokeStats(text) {
  if (!text) return null;
  const section = text.split('## ').find((s) => s.startsWith('2. 冒烟清单'));
  if (!section) return null;
  const rows = section
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|\s*-+/.test(l) && !l.includes('用例'))
    .map((l) => l.split('|').map((c) => c.trim()));
  const total = rows.length;
  const count = (kw) => rows.filter((r) => r[r.length - 2]?.includes(kw)).length;
  return {
    total,
    passed: count('通过'),
    failed: count('失败'),
    pending: count('待测'),
  };
}

/** openspec/ 下的能力规格与在途变更。 */
function specStats(rootDir) {
  const specsDir = join(rootDir, 'openspec', 'specs');
  const changesDir = join(rootDir, 'openspec', 'changes');
  const capabilities = listDirs(specsDir);
  const changes = listDirs(changesDir).filter((d) => d !== 'archive');
  const archived = existsSync(join(changesDir, 'archive')) ? listDirs(join(changesDir, 'archive')) : [];
  return { capabilities, changes, archived };
}

export function collectStatus() {
  const rootDir = root();
  const commitCount = Number(git(['rev-list', '--count', 'HEAD'], { allowFail: true }) ?? 0);
  const firstCommit = git(['log', '--reverse', '--date=short', '--pretty=%ad'], { allowFail: true })?.split('\n')[0] ?? '—';
  const lastCommit = git(['log', '-1', '--date=iso-strict', '--pretty=%ad'], { allowFail: true }) ?? '—';
  const branchCount = git(['branch', '--format=%(refname:short)'], { allowFail: true })?.split('\n').filter(Boolean) ?? [];
  const tags = git(['tag', '--sort=-creatordate'], { allowFail: true })?.split('\n').filter(Boolean) ?? [];
  const shortstat = git(['diff', '--shortstat', `${git(['rev-list', '--max-parents=0', 'HEAD'], { allowFail: true }) ?? 'HEAD'}..HEAD`], { allowFail: true }) ?? '';

  const testing = readIfExists(join(rootDir, 'docs', 'testing.md'));
  const docsFiles = listDirs(join(rootDir, 'docs'));
  const designFiles = existsSync(join(rootDir, 'design-system'))
    ? readdirSync(join(rootDir, 'design-system'), { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name)
    : [];

  return {
    generatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
    commits: { total: commitCount, first: firstCommit, last: lastCommit, shortstat: shortstat.trim() },
    branches: branchCount,
    tags,
    modules: moduleStats(rootDir),
    specs: specStats(rootDir),
    smoke: smokeStats(testing),
    docs: { count: docsFiles.length, designSystem: designFiles.length },
  };
}

/** 渲染成 Markdown（本文件由脚本生成，不要手改）。 */
export function renderStatus(s) {
  const L = [];
  L.push('# 项目状态 · FFShift');
  L.push('');
  L.push(`> 本文件由 \`scripts/lib/status.mjs\` 在每次提交后自动生成，**不要手改**。数据截至 ${s.generatedAt}。`);
  L.push('> 用途：一眼看清项目当前的信息密度——代码、规格、测试、文档各到什么程度。');
  L.push('');
  L.push('## 概览');
  L.push('');
  L.push('| 项 | 值 |');
  L.push('| --- | --- |');
  L.push(`| 提交总数 | ${s.commits.total} |`);
  L.push(`| 首个提交 | ${s.commits.first} |`);
  L.push(`| 最近提交 | ${s.commits.last} |`);
  L.push(`| 累计改动 | ${s.commits.shortstat || '—'} |`);
  L.push(`| 分支 | ${s.branches.join('、') || '—'} |`);
  L.push(`| 版本 Tag | ${s.tags.join('、') || '未打 tag'} |`);
  L.push(`| 文档数 | ${s.docs.count} 份（design-system ${s.docs.designSystem} 份） |`);
  L.push(`| 能力规格 | ${s.specs.capabilities.length} 个 |`);
  L.push(`| 在途变更 | ${s.specs.changes.length} 个（已归档 ${s.specs.archived.length} 个） |`);
  L.push('');

  L.push('## 模块进度');
  L.push('');
  if (s.modules.length) {
    L.push('| 模块 | 提交数 | 最近改动 |');
    L.push('| --- | --- | --- |');
    for (const m of s.modules) L.push(`| ${m.name} | ${m.commits} | ${m.last} |`);
  } else {
    L.push('代码模块尚未创建（`src/features/` 为空）。');
  }
  L.push('');

  L.push('## 测试执行');
  L.push('');
  if (s.smoke) {
    const pct = s.smoke.total ? Math.round((s.smoke.passed / s.smoke.total) * 100) : 0;
    L.push(`冒烟清单 ${s.smoke.total} 条：通过 ${s.smoke.passed} · 失败 ${s.smoke.failed} · 待测 ${s.smoke.pending}（完成度 ${pct}%）`);
  } else {
    L.push('未在 `docs/testing.md` 找到冒烟清单。');
  }
  L.push('');

  L.push('## 能力规格清单');
  L.push('');
  if (s.specs.capabilities.length) {
    for (const c of s.specs.capabilities) L.push(`- \`${c}\``);
  } else {
    L.push('尚未沉淀能力规格。开发每个模块前，先用 `/opsx:propose` 立提案，完成后归档。');
  }
  L.push('');
  return L.join('\n');
}
