import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 纯函数与主进程逻辑跑在 node 环境；组件测试另外用注释单独指定
    environment: 'node',
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts', 'scripts/**/*.test.ts'],
    // 需要真实 ffmpeg 的用例单独跑：npm run test:integration
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
    globals: false,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'electron/**'],
      reporter: ['text', 'json-summary'],
    },
  },
});
