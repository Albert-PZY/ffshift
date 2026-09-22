/**
 * 把 ffmpeg 的英文报错翻译成人话。
 *
 * 设计取舍：只翻译"用户能自己解决"的错误；翻译不了的保留原始输出摘要，
 * 让用户能复制给他人——比编一句笼统的"转换失败"有用。
 */

export type ErrorKind =
  | 'input-missing'
  | 'corrupt'
  | 'output-permission'
  | 'disk-full'
  | 'encoder'
  | 'cancelled'
  | 'unknown';

export interface TranslatedError {
  kind: ErrorKind;
  /** 一句话说清发生了什么 */
  title: string;
  /** 用户下一步可以做什么 */
  hint: string;
  /** 原始输出末尾若干行，供"查看日志"展开 */
  raw: string;
}

interface ErrorRule {
  kind: ErrorKind;
  test: RegExp;
  title: string;
  hint: string;
}

const RULES: ErrorRule[] = [
  {
    kind: 'disk-full',
    test: /no space left on device|enospc|disk full/i,
    title: '目标磁盘空间不足',
    hint: '清理一些空间，或把输出目录换到别的盘，然后重新开始这一项。',
  },
  {
    kind: 'output-permission',
    // 必须排在 input-missing 之前：输出打不开时的文案里也可能出现 No such file or directory，
    // 若先匹配到输入规则，用户会照着"重新导入"白忙一场
    test: /error opening output|permission denied|read-only file system|access is denied/i,
    title: '输出位置不能写入',
    hint: '确认输出目录存在并有写权限；如果文件正被播放器或资源管理器占用，先关掉它。',
  },
  {
    kind: 'encoder',
    test: /unknown encoder|cannot load|nvcuda|no capable devices|not found for encoder/i,
    title: '这个编码器在这台机器上不可用',
    hint: '到设置里重新检测硬件加速，或改用「均衡」档（CPU 软编）。',
  },
  {
    kind: 'corrupt',
    test: /moov atom not found|invalid data found|error while decoding|corrupt|header missing/i,
    title: '文件损坏或格式无法解析',
    hint: '先确认这个文件能正常播放；下载中断的文件需要重新获取。',
  },
  {
    kind: 'input-missing',
    test: /no such file or directory|error opening input|could not find codec parameters/i,
    title: '找不到输入文件',
    hint: '文件可能被移动、改名或删除，重新导入一次。',
  },
];

/** 只保留末尾几行：ffmpeg 的真正原因通常在最后。 */
function summarize(stderr: string): string {
  return stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-10)
    .join('\n');
}

export function translateError(stderr: string, exitCode: number | null): TranslatedError {
  const raw = summarize(stderr);

  // 被我们主动结束的进程：信号终止或约定退出码 255，且没有实质报错
  const looksCancelled = exitCode === null || (exitCode !== 0 && raw === '');
  if (looksCancelled) {
    return {
      kind: 'cancelled',
      title: '任务已取消',
      hint: '这是你手动停止的，不是失败。需要时可以重新开始。',
      raw,
    };
  }

  for (const rule of RULES) {
    if (rule.test.test(stderr)) {
      return { kind: rule.kind, title: rule.title, hint: rule.hint, raw };
    }
  }

  return {
    kind: 'unknown',
    title: '转换失败，原因未识别',
    hint: '展开日志看看末尾几行；复制日志可以发给同事一起排查。',
    raw,
  };
}
