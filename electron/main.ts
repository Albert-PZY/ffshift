import { app, BrowserWindow, shell } from 'electron';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { THEME_ARG_PREFIX, windowBackground } from '../src/lib/theme';
import { disposeIpc, registerIpc } from './ipc';
import { loadSettings } from './settings';

/**
 * 自动截图必须从干净状态拍。
 *
 * 用开发机上那份真实设置的话，档位、主题、输出目录都会跟着走——
 * README 里那张图就变成了"某台机器的状态"，而不是"这个版本长什么样"。
 * 显式传了 --user-data-dir 就听传进来的那个（端到端测试就是这么用的）。
 */
const shotProfile = join(app.getPath('temp'), 'ffshift-shot-profile');
if (process.env.FFSHIFT_SMOKE === 'shot' && !process.argv.some((arg) => arg.startsWith('--user-data-dir'))) {
  rmSync(shotProfile, { recursive: true, force: true });
  app.setPath('userData', shotProfile);
}

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // 主题要在建窗口之前读出来：窗口底色与首帧都靠它，
  // 晚一步就是每次启动闪一下另一个颜色（暗色用户尤其明显）
  const theme = loadSettings().theme;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    // 与当前主题的 --background 同一个值：窗口先出来时不该闪一下另一个颜色
    backgroundColor: windowBackground(theme),
    show: false,
    // 无边框：标题栏、最小化 / 最大化 / 关闭都由界面自绘，
    // 这样顶栏才能跟侧栏、工作区用同一套底色与 1px 分隔线，而不是被系统的灰条截断
    frame: false,
    title: 'FFShift',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // 渲染进程要能同步拿到主题，见 src/lib/ipc-types.ts 的 initialTheme
      additionalArguments: [`${THEME_ARG_PREFIX}${theme}`],
    },
  });

  // 先渲染再显示，避免白屏闪一下
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // 冒烟自检：CI 或脚本里验证"窗口能建、页面能加载"，不依赖人手点
  if (process.env.FFSHIFT_SMOKE === '1') {
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('[smoke] 渲染进程加载完成');
      setTimeout(() => app.exit(0), 800);
    });
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('[smoke] 渲染进程异常退出：', details.reason);
      app.exit(2);
    });
    mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
      console.error(`[smoke] 页面加载失败：${code} ${description}`);
      app.exit(3);
    });
  }

  // 端到端自检：让渲染进程真的走一遍 探测 → 缩略图 → 转换，验证整条 IPC 链路
  if (process.env.FFSHIFT_SMOKE === 'e2e') {
    mainWindow.webContents.once('did-finish-load', async () => {
      const file = process.env.FFSHIFT_SMOKE_FILE ?? '';
      const output = process.env.FFSHIFT_SMOKE_OUTPUT ?? '';
      try {
        const script = `(async () => {
          const probe = await window.ffshift.probe(${JSON.stringify(file)});
          if (!probe.ok || !probe.info) return { stage: 'probe', error: probe.reason ?? '探测失败' };
          const thumb = await window.ffshift.thumbnail(${JSON.stringify(file)}, probe.info.durationSec);
          if (!thumb.ok) return { stage: 'thumbnail', error: thumb.reason ?? '抽帧失败' };

          const done = new Promise((resolve) => {
            window.ffshift.onFinished((event) => resolve(event.outcome));
          });
          const started = await window.ffshift.convert({
            taskId: 'e2e-task',
            input: ${JSON.stringify(file)},
            output: ${JSON.stringify(output)},
            preset: 'balanced',
            hasAudio: probe.info.hasAudio,
            durationSec: probe.info.durationSec,
          });
          if (!started.ok) return { stage: 'convert', error: started.reason };
          const outcome = await done;

          return { stage: 'done', width: probe.info.width, hasThumb: true, outcome };
        })()`;

        const result: unknown = await mainWindow?.webContents.executeJavaScript(script);
        console.log('[e2e] 结果：', JSON.stringify(result));
        app.exit(0);
      } catch (error) {
        console.error('[e2e] 失败：', error instanceof Error ? error.message : error);
        app.exit(1);
      }
    });
  }

  // 自动截图：把真实界面拍下来放进 README，省得手工截图还每次都不一样
  if (process.env.FFSHIFT_SMOKE === 'shot') {
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        const target = process.env.FFSHIFT_SMOKE_OUTPUT ?? 'docs/screenshot.png';
        const fixture = process.env.FFSHIFT_SMOKE_FILE;

        if (fixture) {
          await mainWindow?.webContents.executeJavaScript(
            `window.__ffshift?.addFiles([${JSON.stringify(fixture)}])`,
          );
          // 等探测与缩略图落地，让截图里有真实内容
          await new Promise((resolve) => setTimeout(resolve, 4000));
        }

        if (process.env.FFSHIFT_SMOKE_THEME) {
          // 主题按钮只有图标，认不了文字，按 aria-label 找
          const label =
            process.env.FFSHIFT_SMOKE_THEME === 'dark' ? '切换到暗色主题' : '切换到亮色主题';
          await mainWindow?.webContents.executeJavaScript(
            `[...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === ${JSON.stringify(label)})?.click()`,
          );
          await new Promise((resolve) => setTimeout(resolve, 600));
        }

        if (process.env.FFSHIFT_SMOKE_SETTINGS) {
          // 设置页只有图标入口与分类文字可用：齿轮认 data-slot，分类按文字找
          const category = JSON.stringify(process.env.FFSHIFT_SMOKE_SETTINGS);
          await mainWindow?.webContents.executeJavaScript(
            `document.querySelector('[data-slot="settings-button"]')?.click()`,
          );
          await new Promise((resolve) => setTimeout(resolve, 300));
          await mainWindow?.webContents.executeJavaScript(
            `[...document.querySelectorAll('[data-slot="settings-nav-item"]')].find((b) => b.textContent?.trim() === ${category})?.click()`,
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const image = await mainWindow?.webContents.capturePage();
        if (image) writeFileSync(target, image.toPNG());
        console.log('[shot] 截图已保存：', target);
        app.exit(0);
      } catch (error) {
        console.error('[shot] 截图失败：', error instanceof Error ? error.message : error);
        app.exit(1);
      }
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

void app.whenReady().then(() => {
  registerIpc({ getWindow: () => mainWindow });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // 退出前把还在跑的 ffmpeg 一起结束，避免留下孤儿进程
  disposeIpc();
  if (process.platform !== 'darwin') app.quit();
});
