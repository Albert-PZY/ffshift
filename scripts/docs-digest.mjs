#!/usr/bin/env node
/**
 * 处理 AI 草稿（.ffshift/pending/）。
 *   node scripts/docs-digest.mjs            # 列出草稿
 *   node scripts/docs-digest.mjs --show     # 打印全文
 *   node scripts/docs-digest.mjs --apply    # 归档已采纳的草稿
 *
 * 设计边界：草稿里的判断性内容（影响面、规格建议、风险）不自动写进权威文档——
 * decisions.md 是人的决策，openspec/specs 是规格，都要求人签字。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './lib/git.mjs';
import { config, title, ok, info, warn } from './lib/env.mjs';

const rootDir = root();
const cfg = config();
const pendingDir = join(rootDir, cfg.docs?.pendingDir ?? '.ffshift/pending');
const adoptedDir = join(rootDir, '.ffshift', 'logs', 'adopted');

const args = process.argv.slice(2);
const show = args.includes('--show');
const apply = args.includes('--apply');

title('FFShift · 变更草稿');

if (!existsSync(pendingDir)) {
  info('没有草稿目录，说明还没有过提交沉淀。');
  process.exit(0);
}

const files = readdirSync(pendingDir).filter((f) => f.endsWith('.md')).sort();
if (!files.length) {
  ok('没有待处理的草稿');
  process.exit(0);
}

const parse = (p) => {
  const text = readFileSync(p, 'utf8');
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  const meta = {};
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^([a-z_]+):\s*(.*)$/i);
      if (m) meta[m[1]] = m[2];
    }
  }
  const summary = text.match(/## 摘要\n+([^\n]+)/)?.[1] ?? '—';
  const todos = [...text.matchAll(/^- \[ \] (.+)$/gm)].map((m) => m[1]);
  const risk = text.match(/## 风险 \/ 未验证\n+([^\n]+)/)?.[1] ?? '—';
  const specNote = /## 建议的规格补充\n+```markdown\n([\s\S]*?)```/.test(text);
  return { meta, summary, todos, risk, specNote, text };
};

console.log(`\n共 ${files.length} 份草稿：\n`);
for (const f of files) {
  const { meta, summary, todos, risk, specNote } = parse(join(pendingDir, f));
  const age = ((Date.now() - statSync(join(pendingDir, f)).mtimeMs) / 3600000).toFixed(1);
  console.log(`▸ ${f}  (${age}h 前 · ${meta.subject ?? ''})`);
  console.log(`  摘要：${summary}`);
  if (todos.length) console.log(`  待办：${todos.join('；')}`);
  console.log(`  风险：${risk}`);
  if (specNote) console.log('  ⚑ 含规格建议：走 /opsx:propose 或 openspec change 落进 specs');
  if (show) console.log('\n' + '-'.repeat(60) + '\n' + readFileSync(join(pendingDir, f), 'utf8'));
  console.log('');
}

if (!apply) {
  info('要归档已采纳的草稿：npm run docs:digest -- --apply');
  info('要读全文：npm run docs:digest -- --show');
  process.exit(0);
}

mkdirSync(adoptedDir, { recursive: true });
let moved = 0;
for (const f of files) {
  const dest = join(adoptedDir, f);
  if (existsSync(dest)) {
    warn(`${f} 已归档过，跳过`);
    continue;
  }
  renameSync(join(pendingDir, f), dest);
  moved++;
}
ok(`已归档 ${moved} 份草稿 → .ffshift/logs/adopted/`);
info('注意：归档只是收尾。判断性内容要人工抄进 docs/decisions.md 或 openspec/specs/。');
