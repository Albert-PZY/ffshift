#!/usr/bin/env node
/**
 * post-commit：异步触发文档沉淀。钩子本身立刻返回，不拖慢提交。
 * 沉淀逻辑与失败处理都在 scripts/sync-docs.mjs，日志落在 .ffshift/logs/sync.log。
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, info } from '../lib/env.mjs';
import { lastCommit } from '../lib/git.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = join(here, '..', '..');

try {
  const cfg = config();
  const docs = cfg.docs ?? {};
  if (docs.autoAppendCommitLog === false && docs.aiDraft === false) process.exit(0);

  // 机器提交不再触发沉淀：否则 autoCommit 会自己触发自己，产生级联提交
  if (/^docs: 自动沉淀/.test(lastCommit().subject)) process.exit(0);

  mkdirSync(join(rootDir, '.ffshift', 'logs'), { recursive: true });
  const syncScript = join(rootDir, 'scripts', 'sync-docs.mjs');
  if (!existsSync(syncScript)) process.exit(0);

  const child = spawn(process.execPath, [syncScript, lastCommit().sha], {
    cwd: rootDir,
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  child.unref();
  info('FFShift · post-commit：文档沉淀已在后台启动（日志 .ffshift/logs/sync.log）');
} catch (err) {
  // 沉淀失败绝不能影响提交本身
  info(`FFShift · post-commit 跳过：${err.message}`);
}
process.exit(0);
