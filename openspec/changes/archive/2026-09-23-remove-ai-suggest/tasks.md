## 1. 主进程

- [x] 删除 `electron/ai.ts`（模型调用与降级）
- [x] 删掉 `ffshift:ai-suggest` 这条 IPC 通道
- [x] 清掉主进程的其它引用（自动自检脚本里的那一步）

## 2. 渲染进程

- [x] 删除 `src/lib/ai-suggest.ts` 与它的单测
- [x] 契约层去掉 `SuggestResponse` 与 `suggest`
- [x] preload 白名单去掉 `suggest`
- [x] 删掉设置栏里的建议面板组件
- [x] store 去掉 `applySuggestion`；保留 `setTargetSize` 与目标体积输入框

## 3. 文档

- [x] `docs/ui-spec.md`：去掉 AI 建议区，界面结构图同步
- [x] `docs/architecture.md`：去掉 AI 能力章节与文件树条目
- [x] `docs/decisions.md`：ADR-005 标记为被替代，补一条新决策记理由与代价
- [x] `docs/git-workflow.md` 与 `scripts/lib/rules.mjs`：area 表去掉 `ai`
- [x] `docs/testing.md`：去掉该模块的测试行，更新用例数

## 4. 验证

- [x] `npm run typecheck`
- [x] `npm run test:unit`（235 条）
- [x] `npm run build`
- [x] `npm run test:e2e`（12 条）
- [x] 界面截图重拍（设置栏少一段）
