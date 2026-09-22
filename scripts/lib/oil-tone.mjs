/**
 * oil-tone 文风检查的接入层。
 *
 * oil-tone 是一份外部文风规范（含 scripts/tone_lint.py）。它不随本项目分发，
 * 所以这里做的是"能找就用、找不到就跳过"，不让项目硬依赖某台机器上的 skill。
 *
 * 定位顺序：环境变量 OIL_TONE_HOME → 用户目录 ~/.agents/skills/oil-tone → 仓库内 .agents/skills/oil-tone
 * python 顺序：python → python3 → py
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const LINE_PATTERN = /^(FAIL|WARN)\s+(.+?):(\d+):\s*(.*)$/;
const FIX_PATTERN = /^\s{2,}(\S.*)$/;

export function locateOilTone() {
  const candidates = [
    process.env.OIL_TONE_HOME,
    join(homedir(), '.agents', 'skills', 'oil-tone'),
    join(process.cwd(), '.agents', 'skills', 'oil-tone'),
    join(process.cwd(), '..', '.agents', 'skills', 'oil-tone'),
  ].filter(Boolean);

  for (const dir of candidates) {
    const script = join(dir, 'scripts', 'tone_lint.py');
    if (existsSync(script)) return { dir, script };
  }
  return null;
}

function pythonBin() {
  for (const bin of ['python', 'python3', 'py']) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore', timeout: 15000 });
      return bin;
    } catch {
      /* 继续找下一个 */
    }
  }
  return null;
}

/** 解析 tone_lint.py 的输出：FAIL / WARN 各占一行，紧跟一行缩进的修改建议。 */
export function parseLintOutput(raw) {
  const fails = [];
  const warns = [];
  let last = null;
  // 必须按 \r?\n 切：Python 在 Windows 上输出 CRLF，行尾的 \r 会让 `(.*)$` 永远匹配不上
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(LINE_PATTERN);
    if (m) {
      const entry = { level: m[1], file: m[2], line: Number(m[3]), text: m[4].trim(), fix: '' };
      (m[1] === 'FAIL' ? fails : warns).push(entry);
      last = entry;
      continue;
    }
    const f = line.match(FIX_PATTERN);
    if (f && last && !last.fix) last.fix = f[1].trim();
  }
  return { fails, warns };
}

/**
 * 检查若干文件。
 * @returns {{available: boolean, reason?: string, fails: Array, warns: Array, dir?: string}}
 */
export function lintFiles(files) {
  const found = locateOilTone();
  if (!found) return { available: false, reason: '未找到 oil-tone skill（可用 OIL_TONE_HOME 指定路径）', fails: [], warns: [] };

  const py = pythonBin();
  if (!py) return { available: false, reason: 'python 不可用，跳过文风检查', fails: [], warns: [], dir: found.dir };

  const fails = [];
  const warns = [];
  for (const file of files) {
    let raw = '';
    try {
      raw = execFileSync(py, [found.script, file], { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      raw = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    }
    const parsed = parseLintOutput(raw);
    fails.push(...parsed.fails);
    warns.push(...parsed.warns);
  }
  return { available: true, fails, warns, dir: found.dir };
}
