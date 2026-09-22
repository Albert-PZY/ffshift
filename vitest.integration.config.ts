import { defineConfig } from 'vitest/config';

/**
 * 集成测试：真的调用本机 ffmpeg / ffprobe。
 * 环境里没有 ffmpeg 时用例自动跳过（见各测试文件的 describe.skipIf）。
 * 运行：npm run test:integration
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.integration.test.ts'],
    exclude: ['**/node_modules/**'],
    globals: false,
    // 真实转码慢，给足时间
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // 避免多个用例同时跑 ffmpeg 抢 CPU
    fileParallelism: false,
    reporters: ['default'],
  },
});
