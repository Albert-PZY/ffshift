import { defineConfig } from 'vitest/config';

/**
 * 端到端测试配置。
 *
 * 与单测/集成测试的区别：这里驱动的是**真实界面**——启动项目自己的 Electron，
 * 用真实点击与输入走完 渲染进程 → IPC → 主进程 → ffmpeg 的全链路。
 * 所以跑之前必须先 build（脚本里已经串好），并且必须串行：多个实例会抢同一份资源。
 */
export default defineConfig({
  test: {
    include: ['e2e/**/*.e2e.test.ts'],
    // 启动应用 + 探测 + 转换，单条用例动辄十几秒
    testTimeout: 180_000,
    hookTimeout: 120_000,
    // 一次只跑一个文件、一个用例：Electron 实例之间会互相干扰
    fileParallelism: false,
    sequence: { concurrent: false },
    reporters: ['default'],
  },
});
