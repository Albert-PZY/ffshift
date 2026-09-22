# AI 事实清单 · FFShift

> 喂给 AI 的项目事实。目的只有一个：**堵住幻觉**——模型不许提这里没写的东西。
> 每次 AI 沉淀（`scripts/sync-docs.mjs`）都会把本文件带进提示词。

## 项目是什么

- FFShift：Windows 优先的桌面视频格式转换器，Electron + React + TypeScript。
- 转换一律走 `ffmpeg.exe` / `ffprobe.exe` 子进程（CLI），不接 libav API。
- 当前阶段：文档与工程规范已就位，`src/` 尚未开始写代码。

## 工具链（不要臆造别的）

| 用途 | 本项目用的 | 明确没用 |
| --- | --- | --- |
| git 钩子 | 原生 git hooks，`core.hooksPath = .githooks` | husky、pre-commit 框架、lefthook |
| 规格管理 | OpenSpec（`openspec/specs` 与 `openspec/changes`） | Jira、GitHub Projects |
| 文案检查 | oil-tone skill 的 `tone_lint.py`，由 pre-commit 调用；项目落地规则在 `docs/writing-style.md` | 自研文风模型 |
| 文档沉淀 | `scripts/sync-docs.mjs` + `.ffshift/pending/` 草稿 | 无 |
| CI | 尚未配置 | GitHub Actions 流水线（还没有） |

## 可用命令（只有这些）

```
npm run hooks:install   # 装钩子
npm run hooks:verify     # 17 条钩子冒烟用例
npm run docs:sync        # 手动补跑沉淀
npm run docs:digest      # 查看/归档 AI 草稿
npm run lint:commit      # 校验最近一次提交信息
```

## 规矩

- 主分支 `main` 受保护：改动走 `<前缀>/<模块>-<动作>` 分支，再经 PR 合并。
- 提交信息：`<area>: <祈使句>`，正文写"为什么"；area 见 `docs/git-workflow.md` §3。
- 文案契约：`docs/writing-style.md`（禁空话、祈使句、术语与状态词统一）。
- 状态词只有五个：排队中 / 转换中 / 已完成 / 失败 / 已取消。

## 写草稿时的红线

1. 只根据给出的提交信息与文件清单写，**不要推测未列出的文件或功能**。
2. 不确定就写"待确认"，不要编一个听起来合理的答案。
3. 不要提上表"明确没用"里的任何工具。
4. 不要给建议性的重构方案——只要"这次改动留下了什么"。
