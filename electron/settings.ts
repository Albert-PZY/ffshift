/**
 * 设置的落盘与读取（主进程侧）。
 * 位置：userData/settings.json —— 卸载应用不会连带删用户视频，改设置也只影响这一份文件。
 */
import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  serializeSettings,
  type AppSettings,
} from '../src/lib/settings';

export function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): AppSettings {
  const file = settingsFile();
  if (!existsSync(file)) return { ...DEFAULT_SETTINGS };

  try {
    return parseSettings(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    // 文件被改坏也要能启动：回到默认值，下次保存会覆盖掉坏内容
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(input: unknown): AppSettings {
  const normalized = parseSettings(input);
  const file = settingsFile();

  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, serializeSettings(normalized), 'utf8');
  } catch (error) {
    console.error('[ffshift] 设置写入失败：', error instanceof Error ? error.message : error);
  }

  return normalized;
}
