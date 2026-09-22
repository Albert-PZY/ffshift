/**
 * git 命令薄封装：统一 UTF-8、关掉路径转义（中文路径必须）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const COMMON = ['-c', 'core.quotepath=false', '-c', 'i18n.logoutputencoding=UTF-8'];

export function git(args, { allowFail = false, cwd = process.cwd() } = {}) {
  try {
    const out = execFileSync('git', [...COMMON, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
    return out.replace(/\r?\n$/, '');
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

export const root = () => git(['rev-parse', '--show-toplevel']);

export const branch = () =>
  git(['symbolic-ref', '--short', '-q', 'HEAD'], { allowFail: true }) ?? '(detached)';

export const head = () => git(['rev-parse', '--short', 'HEAD'], { allowFail: true });

export const hasCommits = () => git(['rev-parse', '--verify', '-q', 'HEAD'], { allowFail: true }) !== null;

export const gitPath = (name) => git(['rev-parse', '--git-path', name]);

/** 合并 / rebase 进行中时，允许在保护分支上产生提交（这是"由其它分支合并进主分支"的正当路径）。 */
export function mergeOrRebaseInProgress() {
  return ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD'].some((p) =>
    existsSync(join(process.cwd(), gitPath(p))),
  );
}

export const stagedFiles = () =>
  git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

export const stagedDeletedFiles = () =>
  git(['diff', '--cached', '--name-only', '--diff-filter=D'])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

export const showStaged = (path) => git(['show', `:${path}`], { allowFail: true });

export const lastCommit = () => ({
  sha: git(['rev-parse', 'HEAD']),
  short: git(['rev-parse', '--short', 'HEAD']),
  subject: git(['log', '-1', '--pretty=%s']),
  body: git(['log', '-1', '--pretty=%b']),
  author: git(['log', '-1', '--pretty=%an']),
  date: git(['log', '-1', '--date=iso-strict', '--pretty=%ad']),
  files: git(['show', '--pretty=format:', '--name-only', 'HEAD'])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean),
  stat: git(['show', '--stat', '--pretty=format:', 'HEAD'], { allowFail: true }) ?? '',
});
