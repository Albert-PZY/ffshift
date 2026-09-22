#!/usr/bin/env node
/**
 * commit-msg：按 docs/git-workflow.md §2 §3 校验提交信息。
 */
import { readFileSync } from 'node:fs';
import { config, ok, fail, warn, info, title } from '../lib/env.mjs';
import { validateCommitMessage, AREAS } from '../lib/rules.mjs';

const msgFile = process.argv[2];
if (!msgFile) {
  console.error('commit-msg 钩子缺少参数（提交信息文件路径）');
  process.exit(1);
}

const raw = readFileSync(msgFile, 'utf8');
const cleaned = raw
  .split('\n')
  .filter((l) => !l.startsWith('#'))
  .join('\n')
  .trim();

const cfg = config();
const { errors, warnings, hints } = validateCommitMessage(cleaned, cfg.commit ?? {});

title('FFShift · commit-msg');

for (const e of errors) fail(e);
for (const w of warnings) warn(w);
for (const h of hints) info(h);

if (errors.length) {
  console.log('\n规范示例：');
  console.log('  media: 接入 ffprobe 显示视频信息');
  console.log('');
  console.log('  导入后只有文件名，用户不知道时长和分辨率，选参数全靠猜。');
  console.log('  改为并发（≤3）调用 ffprobe，只取能帮用户判断的字段。');
  console.log('');
  console.log('  验证：三种格式各导入一次');
  console.log('  Refs: ADR-003');
  console.log(`\n可用 area：${Object.keys(AREAS).join(' / ')}`);
  console.log('完整规则：docs/git-workflow.md');
  process.exit(1);
}

ok('提交信息符合规范');
