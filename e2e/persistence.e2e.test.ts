/**
 * 持久化链路的端到端验证：改过的设置、存下的预设，重启之后还在不在。
 *
 * 这些链路之所以以前测不到，是因为老的自检走主进程直连 ffmpeg，绕过了界面。
 * 这个文件驱动的是真实界面：真实点击、真实输入、真实重启。
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupUserData, launchApp, type LaunchedApp } from './helpers';

describe('持久化：设置与预设', () => {
  let running: LaunchedApp | null = null;
  const dirs: string[] = [];

  /** 参数面板里的 CRF 是第一个数字输入框；限定在对话框与 param-field 之内 */
  const CRF = '[data-slot="dialog-popup"] [data-slot="param-field"] input[type="number"]';
  const USER_CHIP = '[data-slot="preset-chip"][data-owner="user"]';

  const freshDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ffshift-e2e-'));
    dirs.push(dir);
    return dir;
  };

  /** 关掉当前实例，但保留 user-data-dir，供"重启"用 */
  const restart = async (userDataDir: string): Promise<void> => {
    await running?.close();
    running = await launchApp({ userDataDir });
  };

  afterEach(async () => {
    await running?.close();
    running = null;
    for (const dir of dirs) cleanupUserData(dir);
    dirs.length = 0;
  });

  it('存下的预设，重启之后还在', async () => {
    const userDataDir = freshDir();

    running = await launchApp({ userDataDir });
    await running.page.getByRole('button', { name: '专业参数' }).click();
    await running.page.waitForSelector('[data-slot="dialog-popup"]');

    // 填一个 CRF，起个名字存下来
    await running.page.locator(CRF).first().fill('27');
    await running.page.getByPlaceholder('给这套参数起个名字').fill('压缩测试档');
    await running.page.getByRole('button', { name: '存为预设' }).click();

    await running.page.waitForSelector(USER_CHIP);
    expect(await running.page.locator(USER_CHIP).innerText()).toContain('压缩测试档');

    // 重启：同一个 user-data-dir
    await restart(userDataDir);

    await running.page.getByRole('button', { name: '专业参数' }).click();
    await running.page.waitForSelector(USER_CHIP);
    expect(await running.page.locator(USER_CHIP).innerText()).toContain('压缩测试档');
  }, 180_000);

  it('应用预设后，参数真的填进了面板；重启后参数不会跟着跑（预设是模板，不是设置）', async () => {
    const userDataDir = freshDir();

    running = await launchApp({ userDataDir });
    await running.page.getByRole('button', { name: '专业参数' }).click();
    await running.page.waitForSelector('[data-slot="dialog-popup"]');

    // 内置预设「高画质存档」会把 CRF 填成 18
    await running.page.getByRole('button', { name: '高画质存档' }).click();
    expect(await running.page.locator(CRF).first().inputValue()).toBe('18');

    await restart(userDataDir);
    await running.page.getByRole('button', { name: '专业参数' }).click();
    await running.page.waitForSelector('[data-slot="dialog-popup"]');

    // 参数本身不持久化——它是"这次要用什么"，不是"以后都用什么"。
    // 预设列表持久化就够了，用户想复用点一下预设即可。
    expect(await running.page.locator(CRF).first().inputValue()).toBe('');
  }, 180_000);

  it('档位与输出格式改过之后，重启还记着', async () => {
    const userDataDir = freshDir();

    running = await launchApp({ userDataDir });
    // 档位与输出格式都是下拉（不是原生 select，也不是按钮组）
    await running.page.locator('#preset-menu').click();
    await running.page.getByRole('option', { name: '更小' }).click();
    await running.page.locator('#format-menu').click();
    await running.page.getByRole('option', { name: 'MKV' }).click();

    // 等设置落盘（写文件是异步的，退出太快会丢）
    await running.page.waitForTimeout(800);
    await restart(userDataDir);

    expect(await running.page.locator('#preset-menu').innerText()).toContain('更小');
    expect(await running.page.locator('#format-menu').innerText()).toContain('MKV');
  }, 180_000);

  it('默认亮色；切成暗色之后重启还是暗色', async () => {
    const userDataDir = freshDir();
    const isDark = (): Promise<boolean> =>
      running ? running.page.evaluate(() => document.documentElement.classList.contains('dark')) : Promise.resolve(false);

    running = await launchApp({ userDataDir });
    // 默认亮色：<html> 上没有 dark 类
    expect(await isDark()).toBe(false);

    await running.page.getByRole('button', { name: '切换到暗色主题' }).click();
    await running.page.waitForTimeout(800);
    expect(await isDark()).toBe(true);

    await restart(userDataDir);
    // 重启后首帧就是暗色：主题在主进程建窗口之前就读出来了，不会先闪一下亮色
    expect(await isDark()).toBe(true);
    expect(await running.page.getByRole('button', { name: '切换到亮色主题' }).isVisible()).toBe(true);

    // 切回亮色也要记住
    await running.page.getByRole('button', { name: '切换到亮色主题' }).click();
    await running.page.waitForTimeout(800);
    await restart(userDataDir);
    expect(await isDark()).toBe(false);
  }, 180_000);

  it('输出目录也是记忆项：设完之后重启仍显示', async () => {
    const userDataDir = freshDir();

    running = await launchApp({ userDataDir });
    // 先确认默认状态
    expect(await running.page.locator('[data-slot="path-button"] span').innerText()).toBe('与源文件同目录');

    // 原生目录选择框没法自动点，直接走 store 的写入路径验证持久化本身
    await running.page.evaluate(() => {
      const hook = (window as unknown as { __ffshift?: { setOutputDir: (dir: string) => void } }).__ffshift;
      hook?.setOutputDir('D:\\测试输出目录');
    });
    await running.page.waitForTimeout(800);
    await restart(userDataDir);

    expect(await running.page.locator('[data-slot="path-button"] span').innerText()).toContain('测试输出目录');
  }, 180_000);
});
