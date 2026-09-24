/**
 * 外壳行为：拖入与关窗口。
 *
 * 这两条以前是测试盲区——`__ffshift.addFiles` 绕过了拖入，关闭按钮则完全没测过。
 * 拖入用 CDP 的 `Input.dispatchDragEvent` 派发真实拖放事件，
 * 与用户从资源管理器拖文件走的是同一条事件链。
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanupUserData, launchApp, makeFixture, type LaunchedApp } from './helpers';

let running: LaunchedApp | null = null;

/** Node 侧的等待：页面已经关掉时不能用 page.waitForTimeout */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(async () => {
  await running?.close();
  if (running) cleanupUserData(running.userDataDir);
  running = null;
});

/** 往指定坐标派发一次完整的拖放 */
async function dropAt(
  app: LaunchedApp,
  point: { x: number; y: number },
  data: { files?: string[]; uri?: string; text?: string },
): Promise<void> {
  const session = await app.app.context().newCDPSession(app.page);
  const items = data.uri
    ? [{ mimeType: 'text/uri-list', data: data.uri }]
    : data.text
      ? [{ mimeType: 'text/plain', data: data.text }]
      : [];
  const payload = { items, files: data.files ?? [], dragOperationsMask: 1 };
  for (const type of ['dragEnter', 'dragOver', 'drop']) {
    await session.send('Input.dispatchDragEvent', { type, x: point.x, y: point.y, data: payload });
    await app.page.waitForTimeout(150);
  }
  await app.page.waitForTimeout(1500);
}

async function dropzoneCenter(app: LaunchedApp): Promise<{ x: number; y: number }> {
  const box = await app.page.locator('[data-slot="dropzone"]').first().boundingBox();
  if (!box) throw new Error('找不到拖放区');
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}

describe('拖入', () => {
  it('资源管理器拖来的文件能入队', async () => {
    const fixture = makeFixture('drag-plain.mp4');
    running = await launchApp();
    await dropAt(running, await dropzoneCenter(running), { files: [fixture] });

    const tasks = await running.page.evaluate(() => window.__ffshift.state().tasks);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.name).toContain('drag-plain');
  }, 180_000);

  it('只给 text/uri-list 的来源也能入队', async () => {
    // 浏览器、压缩包窗口、部分下载工具都只给 URI。之前 dragover 先判断 types
    // 再 preventDefault，遇到这种来源会提前 return，浏览器连 drop 都不派发。
    const fixture = makeFixture('drag-uri.mp4');
    running = await launchApp();
    const uri = `file:///${fixture.replace(/\\/g, '/').replace(/ /g, '%20')}`;
    await dropAt(running, await dropzoneCenter(running), { uri });

    const tasks = await running.page.evaluate(() => window.__ffshift.state().tasks);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.name).toContain('drag-uri');
  }, 180_000);

  it('拖进来的东西没有可读取路径时，给出提示而不是静默', async () => {
    running = await launchApp();
    await dropAt(running, await dropzoneCenter(running), { text: '一段没有路径的文字' });

    const tasks = await running.page.evaluate(() => window.__ffshift.state().tasks);
    expect(tasks).toHaveLength(0);
    // vitest 的 expect 没有 Playwright 的 toContainText，取文本自己判
    expect(await running.page.locator('[data-slot="notice"]').innerText()).toContain('没有可读取的磁盘路径');
  }, 180_000);
});

describe('关闭窗口', () => {
  it('第一次关闭会问，选后台运行并记住之后不再问', async () => {
    running = await launchApp();

    await running.page.getByRole('button', { name: '关闭' }).click();
    const popup = running.page.locator('[data-slot="dialog-popup"]');
    await popup.waitFor({ state: 'visible' });
    // 入场动画 150ms：等它停下来再点，否则 Playwright 的 actionability 会一直等"稳定"
    await running.page.waitForTimeout(400);

    await running.page.locator('[data-slot="remember-close"]').click();
    await running.page.getByRole('button', { name: '后台运行' }).click();
    await running.page.waitForTimeout(1000);

    // 窗口藏起来但没有销毁：托盘图标还在，转换还能继续跑
    const state = await running.app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      return window ? { visible: window.isVisible(), destroyed: window.isDestroyed() } : null;
    });
    expect(state?.visible).toBe(false);
    expect(state?.destroyed).toBe(false);

    const saved = JSON.parse(readFileSync(join(running.userDataDir, 'settings.json'), 'utf8')) as {
      closeAction: string;
    };
    expect(saved.closeAction).toBe('tray');

    // 再关一次：不再询问
    await running.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.show());
    await running.page.waitForTimeout(500);
    await running.page.getByRole('button', { name: '关闭' }).click();
    await running.page.waitForTimeout(900);
    expect(await popup.count()).toBe(0);
  }, 180_000);

  it('选择记住之后重启，仍然按记住的走', async () => {
    running = await launchApp({ userDataDir: undefined });
    const userDataDir = running.userDataDir;

    await running.page.getByRole('button', { name: '关闭' }).click();
    await running.page.locator('[data-slot="dialog-popup"]').waitFor({ state: 'visible' });
    await running.page.locator('[data-slot="remember-close"]').click();
    // 点了之后应用真的会退出。页面随即消失，所以后续等待放在 Node 侧——
    // Playwright 的 waitForTimeout 走的还是那个页面
    await running.page
      .getByRole('button', { name: '退出应用' })
      .click({ noWaitAfter: true })
      .catch(() => undefined);
    await sleep(1500);
    await running.close().catch(() => undefined);
    running = null;

    // 设置里存的是 quit，重启后关闭窗口不该再问，直接退出
    running = await launchApp({ userDataDir });
    const saved = JSON.parse(readFileSync(join(userDataDir, 'settings.json'), 'utf8')) as { closeAction: string };
    expect(saved.closeAction).toBe('quit');

    await running.page
      .getByRole('button', { name: '关闭' })
      .click({ noWaitAfter: true })
      .catch(() => undefined);
    await sleep(1500);
    const alive = await running.app
      .evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)
      .catch(() => 0);
    expect(alive).toBe(0);
  }, 180_000);
});
