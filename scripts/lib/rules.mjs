/**
 * 提交信息规则：唯一来源是 docs/git-workflow.md §2 §3。
 * AREAS 必须与 §3 的表格一致；改了表格就要改这里。
 */
import { displayWidth, scanTone } from './tone.mjs';

export const AREAS = {
  media: '导入、ffprobe 信息、缩略图',
  convert: '预设、参数构造、任务引擎',
  queue: '队列、进度、取消、重试',
  ai: 'AI 参数助手与降级规则',
  settings: '输出目录、并发、Key',
  lib: '纯函数：参数、进度解析、错误翻译、格式化',
  ui: '通用组件、样式、设计系统落地',
  main: 'Electron 主进程：窗口、托盘、对话框、子进程托管',
  docs: '文档与 README',
  test: '测试代码与素材脚本',
  tool: '钩子、自动化脚本、工程配置',
  build: '依赖与打包配置',
  chore: '杂项：.gitignore、格式化',
};

const AREA_RE = /^([a-z][a-z0-9-]*):\s*(.+)$/;
const SKIP_RE = /^(Merge |Revert "|fixup!|squash!|Initial commit)/;

export function parseSubject(subject) {
  const m = subject.match(AREA_RE);
  return m ? { area: m[1], text: m[2].trim() } : { area: null, text: subject.trim() };
}

/**
 * 校验一条提交信息。
 * @returns {{errors: string[], warnings: string[], hints: string[]}}
 */
export function validateCommitMessage(raw, config = {}) {
  const errors = [];
  const warnings = [];
  const hints = [];
  const maxWidth = config.subjectMaxWidth ?? 60;
  const requireBody = config.requireBody ?? true;
  const bodyMinChars = config.bodyMinChars ?? 12;
  const banWords = config.banWords ?? [];

  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const subject = (lines[0] ?? '').trim();
  const rest = lines.slice(1).join('\n').trim();

  if (!subject) {
    errors.push('提交信息为空。');
    return { errors, warnings, hints };
  }
  // 合并 / 回滚 / 修订提交由 Git 生成，不做格式要求
  if (SKIP_RE.test(subject)) return { errors, warnings, hints };

  const { area, text } = parseSubject(subject);

  if (!area) {
    errors.push(`缺少 area 前缀。格式：<area>: <祈使句描述>，如 "queue: 取消后清理半成品输出文件"。`);
    hints.push(`可用 area：${Object.keys(AREAS).join(' / ')}`);
  } else if (!(area in AREAS)) {
    errors.push(`area "${area}" 不在白名单里（见 docs/git-workflow.md §3）。`);
    hints.push(`可用 area：${Object.keys(AREAS).join(' / ')}`);
  }

  const width = displayWidth(subject);
  if (width > maxWidth) {
    errors.push(`首行显示宽度 ${width} 超过 ${maxWidth}（中文按 2 计；中文建议 ≤25 字）。`);
  }

  if (/[。．.]$/.test(subject)) {
    errors.push('首行结尾不要加句号。');
  }

  if (lines.length > 1 && lines[1].trim() !== '') {
    errors.push('首行与正文之间必须空一行，否则正文会被当成标题的一部分。');
  }

  if (requireBody && rest.replace(/\s/g, '').length < bodyMinChars) {
    errors.push(`正文太短（<$bodyMinChars 字）。写清"为什么改"，不是"改了什么"。`);
  }

  if (rest) {
    const { banHits } = scanTone(rest);
    const hit = banHits.filter((w) => banWords.includes(w));
    if (hit.length) {
      errors.push(`正文含空话：「${hit.join('、')}」。换成具体事实：改了什么、为什么、怎么验证的。`);
    }
  }

  const { banHits: subjectHits, pastTenseHits } = scanTone(subject);
  const subjectBan = subjectHits.filter((w) => banWords.includes(w));
  if (subjectBan.length) {
    errors.push(`首行含空话：「${subjectBan.join('、')}」。`);
  }
  if (pastTenseHits.length) {
    warnings.push('首行像过去式叙述，git 规范要求祈使句：把"修复了 X"改成"修复 X"。');
  }

  if (text && text.length < 4) {
    warnings.push('首行描述太短，读不出改了什么。');
  }

  if (!/^(Refs|Closes|Fixes|Co-authored-by|Signed-off-by):/im.test(rest)) {
    hints.push('建议在正文末尾加 `Refs: ADR-00X` 或 `Closes #12`，方便追溯。');
  }

  return { errors, warnings, hints };
}
