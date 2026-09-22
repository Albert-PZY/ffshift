#!/usr/bin/env node
/**
 * 提交后的文档沉淀（由 post-commit 钩子后台调用，也可手动跑）。
 *   node scripts/sync-docs.mjs [<sha>]
 *
 * 分两层，边界很清楚：
 *   自动写入（确定性，不编造）：ai-session-log 提交流水、testing 执行记录、project-status 状态页
 *   只出草稿（判断性，需人工确认）：影响面、规格补充建议、待办、风险 → .ffshift/pending/
 * 任何失败都不影响提交本身：错误写进 .ffshift/logs/sync.log。
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lastCommit, root, git } from './lib/git.mjs';
import { config } from './lib/env.mjs';
import { chat, extractJson } from './lib/llm.mjs';
import { collectStatus, renderStatus } from './lib/status.mjs';

const rootDir = root();
const cfg = config();
const commit = lastCommit();
const short = commit.short;
const branchName = git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true }) ?? '—';
const logPath = join(rootDir, cfg.docs?.logFile ?? '.ffshift/logs/sync.log');

mkdirSync(join(rootDir, '.ffshift', 'logs'), { recursive: true });
mkdirSync(join(rootDir, cfg.docs?.pendingDir ?? '.ffshift/pending'), { recursive: true });

const log = (msg) => appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
const rel = (p) => join(rootDir, p);

// 第二道保险：自动沉淀提交不再递归（第一道在 post-commit 钩子里）
if (/^docs: 自动沉淀/.test(commit.subject)) {
  log(`${short} skip: 机器提交不触发沉淀`);
  process.exit(0);
}

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const extractVerify = () => commit.body.match(/^验证[：:]\s*(.+)$/m)?.[1]?.trim() ?? '—';

// ── 1. ai-session-log.md：追加提交流水（幂等） ───────────────────────────────
function appendCommitLog() {
  const file = rel(cfg.docs?.commitLogFile ?? 'docs/ai-session-log.md');
  if (!existsSync(file)) return 'skip: ai-session-log.md 不存在';
  let text = readFileSync(file, 'utf8');
  if (text.includes(`<!-- commit:${short} -->`)) return 'skip: 已记录过';

  const heading = '## 提交流水（自动生成）';
  // 幂等标记必须内联在表格行的单元格里：单独一行会切断 Markdown 表格
  const row =
    `| ${stamp()} | ${branchName} | \`${short}\` | ${commit.subject.replace(/\|/g, '/')} | ` +
    `${extractVerify().replace(/\|/g, '/').slice(0, 60)} | ${commit.files.length} <!-- commit:${short} --> |`;

  if (!text.includes(heading)) {
    text = text.trimEnd() + '\n\n---\n\n' + heading + '\n\n' +
      '> 由 post-commit 钩子自动追加：只记事实（分支、提交、摘要、验证、文件数）。人工总结写在上面的会话记录里。\n\n' +
      '| 时间 | 分支 | 提交 | 摘要 | 验证 | 文件数 |\n| --- | --- | --- | --- | --- | --- |\n' +
      row + '\n';
    writeFileSync(file, text, 'utf8');
    return 'ok: 新建流水区块并写入首条';
  }

  // 定位表格最后一行，插到表格末尾（区块后面可能还有别的章节）
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  let lastRow = start;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('|')) lastRow = i;
    else if (lastRow > start && !lines[i].startsWith('|')) break;
  }
  lines.splice(lastRow + 1, 0, row);
  writeFileSync(file, lines.join('\n'), 'utf8');
  return 'ok: 追加一条流水';
}

// ── 2. testing.md：测试相关提交自动登记（待人工填结果） ───────────────────────
function appendTestLog() {
  const files = commit.files;
  const related =
    files.some(
      (f) =>
        /(^|\/)(tests?|__tests__)\//.test(f) ||
        /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) ||
        f === 'scripts/gen-fixtures.ps1' ||
        f === 'scripts/verify-hooks.mjs',
    ) || commit.subject.startsWith('test:');
  if (!related) return 'skip: 与测试无关';

  const file = rel(cfg.docs?.testingFile ?? 'docs/testing.md');
  if (!existsSync(file)) return 'skip: testing.md 不存在';
  let lines = readFileSync(file, 'utf8').split('\n');
  if (lines.some((l) => l.includes(`<!-- commit:${short} -->`))) return 'skip: 已记录过';

  const sectionIdx = lines.findIndex((l) => l.startsWith('## 5. 开发期记录'));
  if (sectionIdx < 0) return 'skip: 找不到"开发期记录"章节';

  // 找该章节表格的最后一行；占位行先删掉
  let anchor = sectionIdx;
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) break;
    if (lines[i].startsWith('|')) anchor = i;
  }
  const row =
    `| ${new Date().toISOString().slice(0, 10)} | \`${short}\` ${commit.subject.replace(/\|/g, '/')} | ${commit.files.length} 个文件 | ` +
    `待人工确认（验证信息：${extractVerify().replace(/\|/g, '/').slice(0, 50)}） <!-- commit:${short} --> |`;

  const placeholder = lines.findIndex((l, i) => i > sectionIdx && /^\|\s*—/.test(l));
  if (placeholder > 0 && placeholder === anchor) lines.splice(placeholder, 1, row);
  else lines.splice(anchor + 1, 0, row);

  writeFileSync(file, lines.join('\n'), 'utf8');
  return 'ok: 登记一条测试记录';
}

// ── 3. project-status.md：确定性状态页 ──────────────────────────────────────
function updateStatus() {
  const md = renderStatus(collectStatus());
  writeFileSync(rel('docs/project-status.md'), md, 'utf8');
  return 'ok: 状态页已刷新';
}

// ── 4. AI 草稿：判断性内容只出草稿，不动权威文档 ──────────────────────────────
async function aiDraft() {
  const ai = cfg.ai ?? {};
  const styleFile = rel(cfg.docs?.styleFile ?? 'docs/writing-style.md');
  const style = existsSync(styleFile) ? readFileSync(styleFile, 'utf8').slice(0, 2200) : '';
  const contextFile = rel('.ffshift/ai-context.md');
  const context = existsSync(contextFile) ? readFileSync(contextFile, 'utf8').slice(0, 3000) : '';
  const specs = existsSync(rel('openspec/specs'))
    ? git(['ls-files', 'openspec/specs'], { allowFail: true })?.split('\n').filter(Boolean) ?? []
    : [];

  const system = [
    '你是 FFShift 项目的变更记录员，为团队写"这次提交留下了什么"的草稿。',
    '只输出 JSON，不写解释、不写客套。',
    '写作要求（必须遵守）：短句、具体、可核对；',
    '禁止空话（如"优化了性能""提升了体验"）；禁止编造未发生的事；',
    '信息不足就写「待确认」，不要猜。',
    context ? `\n===== 项目事实（只能依据这里和下面的提交信息，不许引入其它工具或流程）=====\n${context}` : '',
    style ? `\n===== 项目文案契约摘录 =====\n${style}` : '',
    '',
    '文风红线（oil-tone，成稿必须遵守）：不用宣传黑话（赋能、抓手、闭环）；不用模板化领起语（原因很简单、综上所述）；',
    '不用升华结尾（真正重要的是、这不仅仅是）；不用含糊动作词（搞顺、跑起来、承接需求）；不编造来源。',
  ].join('\n');

  const user = [
    `提交：${commit.subject}`,
    `分支：${branchName}`,
    `作者：${commit.author}`,
    commit.body ? `正文：\n${commit.body}` : '正文：（空）',
    `改动文件（最多 30 个）：\n${commit.files.slice(0, 30).join('\n') || '（无）'}`,
    `已有能力规格：${specs.length ? specs.join(', ') : '（尚无，属正常：项目刚起步）'}`,
    '',
    '输出 JSON：',
    '{',
    '  "summary": "一句话（≤40 字）说清这次提交做了什么",',
    '  "impact": ["受影响的能力或模块，1-3 条"],',
    '  "specNote": "若这次改动影响规格，写出建议补充的 OpenSpec Requirement 片段（含 Scenario）；不影响则空字符串",',
    '  "docTodo": ["需要人工补进文档的点，最多 3 条"],',
    '  "risk": "未验证项或风险；没有写 无"',
    '}',
  ].join('\n');

  const { content, model, usage } = await chat({ system, user, ai });
  const data = extractJson(content);
  if (!data) throw new Error('模型未返回可解析的 JSON');

  const file = join(rootDir, cfg.docs?.pendingDir ?? '.ffshift/pending', `${short}.md`);
  const md = [
    '---',
    `sha: ${commit.sha}`,
    `short: ${short}`,
    `subject: ${commit.subject}`,
    `generated: ${new Date().toISOString()}`,
    `model: ${model}`,
    `tokens: ${usage?.total_tokens ?? '—'}`,
    'status: pending',
    '---',
    '',
    `# 变更草稿 · ${commit.subject}`,
    '',
    '> AI 生成的草稿，未经验证，**不要直接当结论**。人工确认后再抄进 decisions.md 或 spec。',
    '> 采纳完用 `npm run docs:digest -- --apply` 归档。',
    '',
    '## 摘要',
    data.summary ?? '（空）',
    '',
    '## 影响面',
    ...(Array.isArray(data.impact) && data.impact.length ? data.impact.map((i) => `- ${i}`) : ['- （空）']),
    '',
    '## 建议的规格补充',
    data.specNote ? '```markdown\n' + data.specNote + '\n```' : '无',
    '',
    '## 待人工补充',
    ...(Array.isArray(data.docTodo) && data.docTodo.length ? data.docTodo.map((i) => `- [ ] ${i}`) : ['- （空）']),
    '',
    '## 风险 / 未验证',
    data.risk ?? '无',
    '',
  ].join('\n');

  writeFileSync(file, md, 'utf8');
  return `ok: 草稿 → .ffshift/pending/${short}.md`;
}

// ── 5. 可选：把沉淀产物提交掉，避免工作区永远挂着未提交的文档 ───────────────
function autoCommitDocs() {
  if (cfg.docs?.autoCommit !== true) return 'skip: 未开启 autoCommit';
  const protectedBranches = cfg.branchPolicy?.protected ?? ['main'];
  if (protectedBranches.includes(branchName)) return `skip: ${branchName} 受保护，不自动提交`;
  try {
    git(['add', 'docs']);
    if (git(['diff', '--cached', '--quiet'], { allowFail: true }) !== null) return 'skip: 文档无变化';
    // 机器提交也守规范：带正文，且不绕开钩子校验
    git([
      'commit',
      '-m',
      `docs: 自动沉淀 ${short}`,
      '-m',
      '由 post-commit 钩子自动生成：提交流水、测试登记、项目状态页。',
    ]);
    return 'ok: 沉淀产物已自动提交';
  } catch (err) {
    return `失败 ${err.message}`;
  }
}

// ── 执行 ───────────────────────────────────────────────────────────────────
const results = [];
try {
  for (const [name, fn] of [
    ['提交流水', appendCommitLog],
    ['测试登记', appendTestLog],
    ['状态页', updateStatus],
  ]) {
    if (name === '提交流水' && cfg.docs?.autoAppendCommitLog === false) continue;
    if (name === '测试登记' && cfg.docs?.autoAppendTestLog === false) continue;
    try {
      results.push(`${name}: ${fn()}`);
    } catch (err) {
      results.push(`${name}: 失败 ${err.message}`);
    }
  }

  if (cfg.docs?.aiDraft !== false) {
    try {
      results.push(`AI 草稿: ${await aiDraft()}`);
    } catch (err) {
      results.push(`AI 草稿: 失败 ${err.message}`);
    }
  }

  try {
    results.push(`自动提交: ${autoCommitDocs()}`);
  } catch (err) {
    results.push(`自动提交: 失败 ${err.message}`);
  }
} catch (err) {
  results.push(`未预期错误: ${err.stack ?? err.message}`);
}

for (const r of results) log(`${short} ${r}`);
console.log(`[sync-docs] ${short}\n` + results.map((r) => `  ${r}`).join('\n'));
