/**
 * 拖入路径的提取。
 *
 * 拖拽源给的东西不止一种，三种都要认：
 *
 *   1. 从资源管理器拖：`dataTransfer.files` 里有 File 对象，磁盘路径只能问
 *      preload 的 `getPathForFile`（Electron 32 之后 File.path 被移除了）；
 *   2. 有些来源只给 `items`，`files` 是空的；
 *   3. 从浏览器、压缩包窗口、部分下载工具拖：`files` 也是空的，
 *      只有 `text/uri-list` 里的 `file://` URL。
 *
 * 第 3 种以前完全没处理，而且 `dragover` 里先判断 `types` 再 `preventDefault`，
 * 遇到这种来源会提前 return，浏览器就不把窗口当可投放目标——连 drop 事件都不派发，
 * 用户看到的是"拖进去毫无反应"。判断放到 drop 里做，dragover 无条件放行。
 */

/** Windows 绝对路径：`C:\dir\file` 或 `\\server\share\file` */
export function isAbsoluteWindowsPath(value: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\[^\\]/.test(value);
}

/**
 * `file:///C:/a%20b.mp4` → `C:\a b.mp4`。
 *
 * 只认 `file:` 协议；解析不出或不是本机能用的绝对路径时返回 null，
 * 由调用方决定怎么告诉用户——宁可明说读不了，也不要塞一个坏路径进队列。
 */
export function decodeFileUrl(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'file:') return null;

  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    // 百分号转义坏了，说明这串东西不是我们以为的 URL
    return null;
  }

  // UNC：file://server/share/x
  if (url.hostname) return `\\\\${url.hostname}${pathname.replace(/\//g, '\\')}`;

  const path = pathname.replace(/^\//, '').replace(/\//g, '\\');
  // 没有主机名又不是盘符路径（比如 file:///tmp/x），在 Windows 上用不了
  return isAbsoluteWindowsPath(path) ? path : null;
}

/**
 * 一段文本 → 去重后的路径数组。
 *
 * `text/uri-list` 与 `text/plain` 共用：前者按规范一行一个 URI，
 * 后者可能是 `file://` URL，也可能直接就是 `C:\a\b.mp4`（有的工具这么给）。
 * `#` 开头的行是 uri-list 的注释，跳过。
 */
export function pathsFromText(text: string): string[] {
  const paths: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim().replace(/^"(.*)"$/, '$1');
    if (!trimmed || trimmed.startsWith('#')) continue;

    const path = decodeFileUrl(trimmed) ?? (isAbsoluteWindowsPath(trimmed) ? trimmed : null);
    if (path && !paths.includes(path)) paths.push(path);
  }
  return paths;
}
