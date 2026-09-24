import { app, BrowserWindow, Menu, nativeImage, shell, Tray } from 'electron';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FONT_SIZE_ARG_PREFIX } from '../src/lib/font-scale';
import { THEME_ARG_PREFIX, themeLabel, windowBackground } from '../src/lib/theme';
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
let tray: Tray | null = null;

/**
 * 真的在退出吗。
 *
 * 「点关闭」和「退出应用」是两件事：前者按用户偏好可能是缩到托盘。
 * 托盘菜单的退出、系统关机、`app.quit()` 会把它置真，那时才真的放行 close。
 */
let isQuitting = false;

/** 托盘图标。开发时在 resources/，打包后在 resourcesPath（extraResources 铺平） */
function trayIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'tray.png')
    : join(app.getAppPath(), 'resources', 'tray.png');
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/**
 * 常驻托盘。
 *
 * 应用一启动就挂上：转换可能要跑十几分钟，用户会先把窗口关掉。
 * 托盘在，进程就还有个"看得见"的入口，不会变成任务管理器里的幽灵进程。
 */
function createTray(): void {
  if (tray) return;

  const image = nativeImage.createFromPath(trayIconPath());
  // 托盘位置只放得下 16px；256px 的图标直接塞进去会被系统糊成一团
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 }));
  tray.setToolTip('FFShift');

  const menu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: '退出 FFShift',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  // 左键点图标是最自然的"把窗口还给我"，不该还要先弹菜单
  tray.on('click', () => showMainWindow());
}

function createWindow(): void {
  // 主题与字号要在建窗口之前读出来：窗口底色与首帧都靠它们，
  // 晚一步就是每次启动闪一下另一个颜色、或者界面先小后大地跳一下
  const settings = loadSettings();
  const theme = settings.theme;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    // 固定下限：面板宽度不随字号变（见 docs/design-system.md），所以三栏骨架
    // 需要的地方与字号无关；字号很大时顶栏与底栏会折行，那是内容自己的事
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
      // 渲染进程要能同步拿到主题与字号，见 src/lib/ipc-types.ts 的 initialTheme
      additionalArguments: [`${THEME_ARG_PREFIX}${theme}`, `${FONT_SIZE_ARG_PREFIX}${settings.fontSize}`],
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

        // 主题入口在设置页里（标题栏那个切换按钮在 ADR-018 之后撤销了）：
        // 齿轮 → 外观 → 点对应标签 → 返回转换界面
        const theme = process.env.FFSHIFT_SMOKE_THEME;
        if (theme === 'light' || theme === 'dim' || theme === 'dark') {
          const label = JSON.stringify(themeLabel(theme));
          await mainWindow?.webContents.executeJavaScript(
            [
              '(async () => {',
              '  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));',
              '  const bySlot = (s) => document.querySelector(s)?.click();',
              '  const byText = (s, t) => [...document.querySelectorAll(s)].find((el) => el.textContent?.trim() === t)?.click();',
              "  bySlot('[data-slot=\"settings-button\"]');",
              '  await sleep(250);',
              "  byText('[data-slot=\"settings-nav-item\"]', '外观');",
              '  await sleep(250);',
              `  byText('[data-slot="theme-option"]', ${label});`,
              '  await sleep(400);',
              "  bySlot('[data-slot=\"settings-back\"]');",
              '  await sleep(300);',
              '})()',
            ].join('\n'),
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

  // 拖进来的东西没被接住时，Chromium 会默认导航到 file:// —— 整个界面会被
  // 一个视频播放页顶掉。拖放我们已经处理了，这里只是兜底：任何导航一律拦下。
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow?.webContents.getURL() ?? '';
    if (url !== current) event.preventDefault();
  });

  /**
   * 关闭按钮的三种走法（见 src/lib/settings.ts 的 CloseAction）。
   *
   * 决定权在主进程：只有这里知道托盘在不在、窗口是不是最小化了。
   * `ask` 也不能问系统对话框——渲染进程有确认框，样式和其它界面是一致的。
   */
  mainWindow.on('close', (event) => {
    if (isQuitting) return;

    const action = loadSettings().closeAction;

    if (action === 'quit') {
      isQuitting = true;
      return;
    }

    if (action === 'tray') {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }

    // ask：拦下来让界面问。窗口可能正缩在托盘里，先露出来，否则用户会以为卡死了
    event.preventDefault();
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.send('ffshift:ask-close');
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
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showMainWindow();
  });
});

/** 托盘菜单的退出、系统关机、Cmd+Q 都要走这里，否则 close 会被当"点关闭"拦下来 */
app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // 退出前把还在跑的 ffmpeg 一起结束，避免留下孤儿进程
  disposeIpc();
  if (process.platform !== 'darwin') app.quit();
});
