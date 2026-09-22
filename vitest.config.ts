import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 纯函数与主进程逻辑跑在 node 环境；组件测试另外用注释单独指定
    environment: 'node',
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts'],
    globals: false,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'electron/**'],
      reporter: ['text', 'json-summary'],
    },
  },
});
