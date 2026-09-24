import { describe, expect, it } from 'vitest';
import { decodeFileUrl, isAbsoluteWindowsPath, pathsFromText } from './drop';

describe('decodeFileUrl', () => {
  it('盘符路径：正斜杠转反斜杠', () => {
    expect(decodeFileUrl('file:///C:/videos/a.mp4')).toBe('C:\\videos\\a.mp4');
    expect(decodeFileUrl('file:///D:/a/b/c.mkv')).toBe('D:\\a\\b\\c.mkv');
  });

  it('百分号转义解码：空格、中文、括号', () => {
    expect(decodeFileUrl('file:///C:/my%20video/a.mp4')).toBe('C:\\my video\\a.mp4');
    expect(decodeFileUrl('file:///C:/%E8%A7%86%E9%A2%91/x.mp4')).toBe('C:\\视频\\x.mp4');
    expect(decodeFileUrl('file:///F:/%E7%B4%A0%E4%BA%BA/a%20(1).mp4')).toBe('F:\\素人\\a (1).mp4');
  });

  it('UNC 路径保留主机名', () => {
    expect(decodeFileUrl('file://server/share/a.mp4')).toBe('\\\\server\\share\\a.mp4');
  });

  it('非 file 协议一律不认', () => {
    expect(decodeFileUrl('https://example.com/a.mp4')).toBeNull();
    expect(decodeFileUrl('ftp://x/a.mp4')).toBeNull();
    expect(decodeFileUrl('javascript:alert(1)')).toBeNull();
  });

  it('坏输入不抛错，返回 null', () => {
    expect(decodeFileUrl('')).toBeNull();
    expect(decodeFileUrl('   ')).toBeNull();
    expect(decodeFileUrl('file:///C:/bad%ZZ')).toBeNull();
    expect(decodeFileUrl('not a url')).toBeNull();
  });

  it('没有主机名的 POSIX 路径在 Windows 上用不了，返回 null', () => {
    expect(decodeFileUrl('file:///tmp/x.mp4')).toBeNull();
  });
});

describe('isAbsoluteWindowsPath', () => {
  it('盘符与 UNC 都算绝对路径', () => {
    expect(isAbsoluteWindowsPath('C:\\a\\b.mp4')).toBe(true);
    expect(isAbsoluteWindowsPath('c:/a/b.mp4')).toBe(true);
    expect(isAbsoluteWindowsPath('\\\\server\\share\\a.mp4')).toBe(true);
  });

  it('相对路径与纯文件名不算', () => {
    expect(isAbsoluteWindowsPath('a\\b.mp4')).toBe(false);
    expect(isAbsoluteWindowsPath('a.mp4')).toBe(false);
    expect(isAbsoluteWindowsPath('/tmp/a.mp4')).toBe(false);
  });
});

describe('pathsFromText', () => {
  it('多行 uri-list：逐行解析并去重', () => {
    expect(pathsFromText('file:///C:/a.mp4\r\nfile:///C:/b.mp4\r\nfile:///C:/a.mp4')).toEqual([
      'C:\\a.mp4',
      'C:\\b.mp4',
    ]);
  });

  it('跳过 # 注释行与空行', () => {
    expect(pathsFromText('# 注释\r\n\r\nfile:///C:/a.mp4\r\n   ')).toEqual(['C:\\a.mp4']);
  });

  it('裸 Windows 路径也认（有的下载工具直接给路径）', () => {
    expect(pathsFromText('C:\\videos\\a.mp4')).toEqual(['C:\\videos\\a.mp4']);
    expect(pathsFromText('"C:\\带空格的 目录\\a.mp4"')).toEqual(['C:\\带空格的 目录\\a.mp4']);
  });

  it('相对路径、网络地址、乱码都丢掉，不塞坏路径进队列', () => {
    expect(pathsFromText('a.mp4')).toEqual([]);
    expect(pathsFromText('https://example.com/a.mp4')).toEqual([]);
    expect(pathsFromText('这是一段随便的文本')).toEqual([]);
  });

  it('混合来源：只留能用的', () => {
    expect(pathsFromText('https://x/a.mp4\r\nfile:///C:/ok.mp4\r\n垃圾\r\nC:\\also.mp4')).toEqual([
      'C:\\ok.mp4',
      'C:\\also.mp4',
    ]);
  });
});
