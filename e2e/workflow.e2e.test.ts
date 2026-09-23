/**
 * 工作流链路的端到端验证：导入 → 探测 → 转换 → 历史。
 *
 * 与集成测试的分工：集成测试盯着"参数拼得对不对、ffmpeg 跑不跑得通"，
 * 这里盯着"界面点下去之后，整条链路有没有真的走通、状态对不对"。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupUserData, launchApp, makeFixture, waitForTaskStatus, type LaunchedApp } from './helpers';

/** 界面暴露的调试入口；测试通过它导入文件（拖放没法在自动化里模拟真实文件） */
interface DebugHook {
  addFiles: (paths: string[]) => Promise<void>;
  state: () => {
    tasks: Array<{
      status: string;
      output: string | null;
      info: { width: number | null; height: number | null } | null;
      outcome: { status: string; outputSizeBytes?: number | null } | null;
    }>;
  };
}

const importFiles = async (running: LaunchedApp, paths: string[]): Promise<void> => {
  await running.page.evaluate((list) => {
    const hook = (window as unknown as { __ffshift?: DebugHook }).__ffshift;
    return hook?.addFiles(list);
  }, paths);
};

const readState = (running: LaunchedApp): Promise<ReturnType<DebugHook['state']>> =>
  running.page.evaluate(() => (window as unknown as { __ffshift?: DebugHook }).__ffshift?.state() as never);

describe('工作流：导入 → 转换 → 历史', () => {
  let running: LaunchedApp | null = null;

  afterEach(async () => {
    if (running) {
      cleanupUserData(running.userDataDir);
      await running.close();
      running = null;
    }
  });

  it('导入之后能看到真实的分辨率与缩略图', async () => {
    const fixture = makeFixture('流程素材.mp4', { durationSec: 3 });

    running = await launchApp();
    await importFiles(running, [fixture]);
    await waitForTaskStatus(running.page, '待转换', 60_000);

    const meta = await running.page.locator('.queue-meta').first().innerText();
    // 素材是 640x360 生成的，界面该照实显示
    expect(meta).toContain('640×360');
    expect(await running.page.locator('.thumb img').count()).toBe(1);

    const state = await readState(running);
    expect(state.tasks[0]?.info?.width).toBe(640);
  }, 180_000);

  it('点开始转换真的产出文件，并写进历史；重启后历史还在', async () => {
    const fixture = makeFixture('转换素材.mp4', { durationSec: 3 });
    const userDataDir = (await (async () => {
      running = await launchApp();
      return running.userDataDir;
    })()) as string;

    await importFiles(running as LaunchedApp, [fixture]);
    await waitForTaskStatus((running as LaunchedApp).page, '待转换', 60_000);

    await (running as LaunchedApp).page.getByRole('button', { name: '开始转换' }).click();
    await waitForTaskStatus((running as LaunchedApp).page, '已完成', 120_000);

    // 产物路径与体积都该有值——没有的话说明完成事件没把结果带回来
    const state = await readState(running as LaunchedApp);
    expect(state.tasks[0]?.output).toBeTruthy();
    expect(state.tasks[0]?.outcome?.status).toBe('done');
    expect(state.tasks[0]?.outcome?.outputSizeBytes ?? 0).toBeGreaterThan(0);

    // 切到历史视图，记录应该已经在了
    await (running as LaunchedApp).page.getByRole('button', { name: '看历史' }).click();
    await (running as LaunchedApp).page.waitForSelector('.queue-row');
    expect(await (running as LaunchedApp).page.locator('.queue-row').count()).toBeGreaterThan(0);

    // 重启：历史能读回来，说明真的落盘了而不是只在内存里
    await (running as LaunchedApp).close();
    running = await launchApp({ userDataDir });

    await (running as LaunchedApp).page.getByRole('button', { name: '看历史' }).click();
    await (running as LaunchedApp).page.waitForSelector('.queue-row');
    expect(await (running as LaunchedApp).page.locator('.queue-row').count()).toBeGreaterThan(0);
  }, 240_000);

  it('两个文件依次排队，最后都完成（队列是串行的）', async () => {
    const first = makeFixture('队列A.mp4', { durationSec: 2 });
    const second = makeFixture('队列B.mp4', { durationSec: 2 });

    running = await launchApp();
    await importFiles(running, [first, second]);
    await waitForTaskStatus(running.page, '待转换', 60_000);
    expect(await running.page.locator('.queue-row').count()).toBe(2);

    await running.page.getByRole('button', { name: '开始转换' }).click();

    await running.page.waitForFunction(
      () => document.querySelectorAll('.queue-row .status-done').length === 2,
      undefined,
      { timeout: 180_000 },
    );

    const state = await readState(running);
    expect(state.tasks.every((task) => task.status === 'done')).toBe(true);
  }, 240_000);

  it('参数面板：非法值被拦下，主按钮跟着禁用', async () => {
    running = await launchApp();
    await running.page.getByRole('button', { name: '专业参数' }).click();
    await running.page.waitForSelector('.modal');

    // CRF 填 99，超出 x264 的 0–51
    await running.page.locator('.param-field input[type="number"]').first().fill('99');
    await running.page.waitForSelector('.reason');

    expect(await running.page.locator('.reason').first().innerText()).toContain('CRF');
    expect(await running.page.getByRole('button', { name: '参数有误' }).isDisabled()).toBe(true);

    // 改成合法值，错误消失、按钮恢复
    await running.page.locator('.param-field input[type="number"]').first().fill('23');
    await running.page.waitForFunction(() => document.querySelectorAll('.modal .reason').length === 0);
    // exact：界面里还有个「清空已完成」，不精确匹配会同时命中两个
    expect(await running.page.getByRole('button', { name: '完成', exact: true }).isDisabled()).toBe(false);
  }, 180_000);

  it('同一路径导入两次不会重复入队', async () => {
    const fixture = makeFixture('去重素材.mp4', { durationSec: 2 });

    running = await launchApp();
    await importFiles(running, [fixture]);
    await waitForTaskStatus(running.page, '待转换', 60_000);

    await importFiles(running, [fixture]);
    await running.page.waitForTimeout(1000);

    expect(await running.page.locator('.queue-row').count()).toBe(1);
  }, 180_000);
});
