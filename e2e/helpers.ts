/**
 * 端到端测试的公共部分：启动应用、准备素材、清理。
 *
 * 两条纪律：
 *   - 每个用例用独立的 user-data-dir：测试绝不能读到、更绝不能写到用户的真实设置；
 *   - 关应用要等它真的退出：不然下一次启动会撞上文件锁。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication, type Page } from 'playwright-core';

export interface LaunchedApp {
  app: ElectronApplication;
  page: Page;
  /** 本次运行用的 user-data-dir，重启验证时把它传回 launchApp */
  userDataDir: string;
  close: () => Promise<void>;
}

/** 启动应用。不传 userDataDir 就开一个临时目录 */
export async function launchApp(options: { userDataDir?: string } = {}): Promise<LaunchedApp> {
  const userDataDir = options.userDataDir ?? mkdtempSync(join(tmpdir(), 'ffshift-e2e-'));

  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: process.cwd(),
    env: { ...process.env, FFSHIFT_DISABLE_POST_COMMIT: '1' },
  });

  const page = await app.firstWindow();
  // 界面挂载完成：app-shell 是根容器
  await page.waitForSelector('.app-shell', { timeout: 30_000 });

  return {
    app,
    page,
    userDataDir,
    close: async () => {
      await app.close();
    },
  };
}

/** 用完就删临时目录；留着会堆积成灾 */
export function cleanupUserData(userDataDir: string): void {
  try {
    rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    /* 删不掉就算了，不影响测试结论 */
  }
}

/**
 * 现场生成测试素材。
 * 不依赖网络、不依赖仓库里的大文件；每个用例自己造，互不干扰。
 */
export function makeFixture(name: string, options: { durationSec?: number; withAudio?: boolean } = {}): string {
  const { durationSec = 3, withAudio = true } = options;
  const dir = join(tmpdir(), 'ffshift-e2e-fixtures');
  mkdirSync(dir, { recursive: true });

  const target = join(dir, name);
  if (existsSync(target)) return target;

  const ffmpeg = process.env.FFSHIFT_FFMPEG ?? 'ffmpeg';
  const args = ['-hide_banner', '-y', '-f', 'lavfi', '-i', `testsrc2=size=640x360:rate=25`];
  if (withAudio) args.push('-f', 'lavfi', '-i', 'sine=frequency=440');
  args.push('-t', String(durationSec), '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p');
  if (withAudio) args.push('-c:a', 'aac');
  args.push(target);

  execFileSync(ffmpeg, args, { stdio: 'ignore', timeout: 120_000 });
  return target;
}

/** 等某个状态文字出现在队列行上（转换完成、失败等） */
export async function waitForTaskStatus(page: Page, label: string, timeout = 120_000): Promise<void> {
  await page.waitForFunction(
    (text) => [...document.querySelectorAll('.queue-row .status')].some((node) => node.textContent?.includes(text)),
    label,
    { timeout },
  );
}
