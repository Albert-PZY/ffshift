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
import { cleanupUserData, closeSettings, CRF_FIELD, launchApp, openSettings, type LaunchedApp } from './helpers';

describe('持久化：设置与预设', () => {
  let running: LaunchedApp | null = null;
  const dirs: string[] = [];

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
    await openSettings(running.page, '参数预设');

    // 填一个 CRF，起个名字存下来
    await running.page.locator(CRF_FIELD).first().fill('27');
    await running.page.getByPlaceholder('给这套参数起个名字').fill('压缩测试档');
    await running.page.getByRole('button', { name: '存为预设' }).click();

    await running.page.waitForSelector(USER_CHIP);
    expect(await running.page.locator(USER_CHIP).innerText()).toContain('压缩测试档');

    // 重启：同一个 user-data-dir
    await restart(userDataDir);

    await openSettings(running.page, '参数预设');
    await running.page.waitForSelector(USER_CHIP);
    expect(await running.page.locator(USER_CHIP).innerText()).toContain('压缩测试档');
  }, 180_000);

  it('套用内置预设会填进参数，并把结果一起记住', async () => {
    const userDataDir = freshDir();

    running = await launchApp({ userDataDir });
    await openSettings(running.page, '参数预设');

    // 内置预设「高画质存档」会把 CRF 填成 18
    await running.page.getByRole('button', { name: '高画质存档' }).click();
    expect(await running.page.locator(CRF_FIELD).first().inputValue()).toBe('18');
    await running.page.waitForTimeout(800);

    // 参数进了设置页就是设置：重启之后还在（ADR-018 之前它是"这次用什么"，不落盘）
    await restart(userDataDir);
    await openSettings(running.page, '参数预设');
    expect(await running.page.locator(CRF_FIELD).first().inputValue()).toBe('18');
  }, 180_000);

  it('专业参数改过之后落盘，重启还在', async () => {
    const userDataDir = freshDir();

    running = await launchApp({ userDataDir });
    await openSettings(running.page, '参数预设');
    await running.page.locator(CRF_FIELD).first().fill('21');
    await running.page.waitForTimeout(800);

    await restart(userDataDir);
    await openSettings(running.page, '参数预设');
    expect(await running.page.locator(CRF_FIELD).first().inputValue()).toBe('21');
  }, 180_000);

  it('档位与输出格式改过之后，重启还记着', async () => {
    const userDataDir = freshDir();

    running = await launchApp({ userDataDir });
    // 档位与输出格式留在主界面上：它们是每批文件都要重新决定的
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

    await openSettings(running.page, '外观');
    await running.page.getByRole('tab', { name: '暗色' }).click();
    await running.page.waitForTimeout(800);
    expect(await isDark()).toBe(true);

    await restart(userDataDir);
    // 重启后首帧就是暗色：主题在主进程建窗口之前就读出来了，不会先闪一下亮色
    expect(await isDark()).toBe(true);

    // 切回亮色也要记住；顺带确认设置界面上的选中态跟主题是一致的
    await openSettings(running.page, '外观');
    expect(await running.page.getByRole('tab', { name: '暗色' }).getAttribute('data-active')).not.toBeNull();
    await running.page.getByRole('tab', { name: '亮色' }).click();
    await running.page.waitForTimeout(800);
    await restart(userDataDir);
    expect(await isDark()).toBe(false);
  }, 180_000);

  it('输出目录也是记忆项：设完之后重启仍显示', async () => {
    const userDataDir = freshDir();

    running = await launchApp({ userDataDir });
    // 默认分类就是「输出」，先确认默认状态
    await openSettings(running.page);
    expect(await running.page.locator('[data-slot="path-button"] span').innerText()).toBe('与源文件同目录');

    // 原生目录选择框没法自动点，直接走 store 的写入路径验证持久化本身
    await running.page.evaluate(() => {
      const hook = (window as unknown as { __ffshift?: { setOutputDir: (dir: string) => void } }).__ffshift;
      hook?.setOutputDir('D:\\测试输出目录');
    });
    await running.page.waitForTimeout(800);
    await restart(userDataDir);

    await openSettings(running.page);
    expect(await running.page.locator('[data-slot="path-button"] span').innerText()).toContain('测试输出目录');
  }, 180_000);

  it('设置页：能打开、能切分类、能返回', async () => {
    running = await launchApp();

    // 转换界面上有设置栏、没有设置页
    expect(await running.page.locator('[data-slot="settings-rail"]').isVisible()).toBe(true);
    expect(await running.page.locator('[data-slot="settings-view"]').count()).toBe(0);

    await openSettings(running.page, '参数预设');
    expect(await running.page.locator('[data-slot="settings-view"]').isVisible()).toBe(true);
    // 设置页里没有转换栏：两套东西不同屏
    expect(await running.page.locator('[data-slot="settings-rail"]').count()).toBe(0);

    await openSettings(running.page, '关于');
    expect(await running.page.locator('[data-slot="settings-nav-item"][data-active="true"]').innerText()).toBe('关于');

    await closeSettings(running.page);
    expect(await running.page.locator('[data-slot="settings-rail"]').isVisible()).toBe(true);
    expect(await running.page.locator('[data-slot="settings-view"]').count()).toBe(0);
  }, 180_000);

  it('设置栏的「专业参数」直接跳到对应的设置分类', async () => {
    running = await launchApp();

    await running.page.getByRole('button', { name: '专业参数' }).click();
    await running.page.waitForSelector('[data-slot="settings-view"]');
    expect(await running.page.locator('[data-slot="settings-nav-item"][data-active="true"]').innerText()).toBe(
      '参数预设',
    );
  }, 180_000);
});
