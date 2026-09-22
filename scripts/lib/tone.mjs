/**
 * 文案契约：所有自动生成的文字（AI 草稿、提交校验提示、文档沉淀）都过一遍这里。
 * 规则来源：docs/writing-style.md。等 oil-tone 可用后，把它的核心约束补进来。
 */

/** 空话 / AI 味词表：出现即判定为"说不清"，直接拦下。 */
export const BAN_WORDS = [
  '优化了性能',
  '提升了体验',
  '完善了功能',
  '修复了一些问题',
  '代码优化',
  '细节优化',
  '相关调整',
  '若干优化',
  '整体优化',
  '各种优化',
  '做了一些改动',
  'update code',
  'fix bug',
  'improve performance',
];

/** 中文过去式标记：提交首行要用祈使句（"修复 X" 而不是 "修复了 X"）。 */
const PAST_TENSE_HINTS = [/修复了/, /增加了/, /添加了/, /删除了/, /更新了/, /优化了/, /调整了/, /重构了/, /\bfixed\b/i, /\badded\b/i, /\bupdated\b/i, /\bremoved\b/i, /^this commit/i];

/** 单个字符在终端 / GitHub 列表里的显示宽度。 */
export function charWidth(ch) {
  const c = ch.codePointAt(0);
  const wide =
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe6f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x1f300 && c <= 0x1f9ff);
  return wide ? 2 : 1;
}

export const displayWidth = (s) => [...s].reduce((n, ch) => n + charWidth(ch), 0);

/**
 * 文本体检：返回命中的空话与"太长没信息量"的句子。
 * 只做确定性判断，不做主观评价。
 */
export function scanTone(text) {
  const hits = [];
  for (const w of BAN_WORDS) {
    if (text.toLowerCase().includes(w.toLowerCase())) hits.push(w);
  }
  return { banHits: hits, pastTenseHits: PAST_TENSE_HINTS.filter((re) => re.test(text)).map(String) };
}
