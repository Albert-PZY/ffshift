/**
 * ffmpeg 版本串的展示形式。
 *
 * 原始串长这样：
 *   `ffmpeg version 9.0.2-essentials_build-www.gyan.dev Copyright (c) 2000-2026 the FFmpeg developers`
 * 整条塞进顶栏会把窗口控制按钮挤走，截前三个词又会截出
 * `ffmpeg version 9.0.2-essentials_build-www.gyan.dev`——照样半屏。
 * 用户要认的只有版本号，所以只留版本号；完整串放到悬停提示里。
 *
 * 只认 `version` 后面那一个词，不在整条串里搜数字：
 * 后面跟着的版权年份（`2000-2026`）也是个数字，搜出来的会是年份。
 */
export function shortFfmpegVersion(raw: string | null): string {
  const trimmed = raw?.trim();
  if (!trimmed) return '未检测到 ffmpeg';

  const tokens = trimmed.split(/\s+/);
  const index = tokens.indexOf('version');
  const token = index >= 0 ? tokens[index + 1] : undefined;
  // git 构建的版本号是 `n7.0` 这种，前缀不是数字，但版本号本身是小节形式
  const version = token ? /(\d+(?:\.\d+)*)/.exec(token)?.[1] : undefined;

  return version ? `ffmpeg ${version}` : '未检测到 ffmpeg';
}
