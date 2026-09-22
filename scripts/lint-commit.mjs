#!/usr/bin/env node
/**
 * 校验最近一次提交（改历史 / 检查时用）。
 *   node scripts/lint-commit.mjs [sha]
 */
import { git, lastCommit } from './lib/git.mjs';
import { config, title, ok, fail, warn, info } from './lib/env.mjs';
import { validateCommitMessage } from './lib/rules.mjs';

const sha = process.argv[2];
const subject = sha ? git(['log', '-1', '--pretty=%s', sha]) : lastCommit().subject;
const body = sha ? git(['log', '-1', '--pretty=%b', sha]) : lastCommit().body;
const message = `${subject}\n\n${body}`;

const { errors, warnings, hints } = validateCommitMessage(message, config().commit ?? {});

title(`FFShift · 提交信息校验 ${sha ?? 'HEAD'}`);
info(subject);
for (const e of errors) fail(e);
for (const w of warnings) warn(w);
for (const h of hints) info(h);

if (errors.length) process.exit(1);
ok('符合规范');
