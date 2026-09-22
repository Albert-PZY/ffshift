# 自动化机制 · FFShift

> 这份文档回答一个问题：**提交代码之后，哪些事自己会动，哪些必须人来。**
> 规则来源：`docs/git-workflow.md`。文案标准：`docs/writing-style.md`。

## 1. 一页速览

| 事 | 谁做 | 时机 |
| --- | --- | --- |
| 提交信息格式校验（area / 长度 / 祈使句 / 空话） | 钩子，自动拦截 | `git commit` |
| 主分支保护（不让直接提交、直接推） | 钩子，自动拦截 | `git commit` / `git push` |
| 密钥、大文件、禁提交路径、冲突标记 | 钩子，自动拦截 | `git commit` |
| 提交流水写进 `docs/ai-session-log.md` | 钩子，自动写 | 提交后（后台，不阻塞） |
| 测试相关提交登记进 `docs/testing.md` | 钩子，自动写 | 提交后 |
| `docs/project-status.md` 状态页刷新 | 钩子，自动生成 | 提交后 |
| 变更摘要 / 影响面 / 规格补充建议 / 风险 | **AI 出草稿**，人工采纳 | 提交后 → `.ffshift/pending/` |
| ADR 决策、规格正文、测试结论 | **人工** | 随时 |

一句话原则：**能确定性判断的自动写，需要判断力的只出草稿。** 自动写的东西不会编造，草稿永远不会直接改权威文档。

## 2. 四个钩子

| 钩子 | 拦截什么 | 放行条件 |
| --- | --- | --- |
| `pre-commit` | main 上直接提交、分支名不在前缀白名单、`node_modules`/`dist`/`fixtures`/ffmpeg 目录、>50 MiB 文件、密钥字面量、冲突标记、Markdown 的 oil-tone FAIL | 合并 / rebase 中、`FFSHIFT_ALLOW_MAIN_COMMIT=1`、首次提交 |
| `commit-msg` | 缺 area 前缀、area 不在白名单、首行过宽、句号结尾、正文缺失或空话 | 合并 / Revert / 修订提交自动跳过 |
| `pre-push` | 推 `refs/heads/main` | `FFSHIFT_ALLOW_MAIN_PUSH=1`；推功能分支与 tag 不受限 |
| `post-commit` | 不拦截任何东西 | 只负责后台触发沉淀 |

> 密钥扫描会拦"看起来像真 key"的字符串。测试夹具请把样例拆开拼接（`['sk','-xxx'].join('')`），不要为此放宽扫描规则。

## 3. 提交后自动写什么

| 文件 | 写入内容 | 幂等 |
| --- | --- | --- |
| `docs/ai-session-log.md` | "提交流水"表格：时间 / 分支 / 提交 / 摘要 / 验证 / 文件数 | 按提交 sha 去重 |
| `docs/testing.md` | 测试相关提交登记一行，结果列写"待人工确认" | 按提交 sha 去重 |
| `docs/project-status.md` | 提交总数、模块进度、冒烟完成度、规格清单（全部确定性数据） | 每次覆盖重建 |
| `.ffshift/pending/<sha>.md` | AI 草稿：摘要、影响面、规格补充建议、待办、风险 | 每提交一份 |

沉淀产物默认由脚本自己提交（`.ffshift/config.json` 里 `docs.autoCommit`，当前为 `true`）：提交信息形如 `docs: 自动沉淀 <sha>`，走 `--no-verify` 不触发钩子，且**在受保护分支上一律不提交**。想手动掌控就设为 `false`，产物会留在工作区等你下次提交带上。

## 4. AI 的边界

一次提交后，AI 只做一件事：读提交信息 + 文件清单，写一份**草稿**。它不会碰 `decisions.md`、不会改 `openspec/specs/`。

草稿里最有用的两栏：

- **规格补充建议**：给出可直接粘进 OpenSpec 的 Requirement 片段；采纳就走 `/opsx:propose` 或 `openspec change` 流程落进 specs。
- **风险 / 未验证**：明确列出这次没测到的部分——比"已完成"三个字诚实得多。

**防幻觉的做法**：提示词里带一份 `.ffshift/ai-context.md`（技术栈、可用命令、明确没用的工具）。第一次生成草稿时，模型凭空提到了 husky 和 `npm run prepare`——本项目都没有。加上事实清单后这类虚构就消失了。维护它比事后纠错便宜。

接口与密钥：

| 项 | 值 |
| --- | --- |
| 地址 | `https://wb.albert-go.top/v1`（OpenAI 兼容 `/chat/completions`） |
| 密钥 | 环境变量 `WORKBUDDY_API_KEY`（用户级环境变量，脚本会自动读取；**绝不入库**） |
| 模型 | `global:fast-model`（可在 `.ffshift/config.json` 的 `ai.model` 改） |
| 失败处理 | 记进 `.ffshift/logs/sync.log`，不影响提交 |

## 5. 命令

```bash
npm run hooks:install    # 装钩子（新克隆仓库后跑一次）
npm run hooks:verify     # 17 条冒烟用例：拦截与放行是否都正确
npm run docs:sync        # 手动补跑一次沉淀
npm run docs:digest      # 看 AI 草稿；--show 看全文，--apply 归档已采纳
npm run lint:commit      # 校验最近一次提交信息（改历史后用）
```

## 6. 文案契约

所有出口文字（界面、文档、提交信息、AI 草稿）按 `docs/writing-style.md` 执行：三条底线、禁词表、祈使句、术语统一、状态词只有五个。

两层自动检查：

| 检查 | 覆盖 | 实现 |
| --- | --- | --- |
| oil-tone `tone_lint.py` | 暂存的 Markdown：宣传黑话、模板化领起语、含糊动作词 | `scripts/lib/oil-tone.mjs`，pre-commit 调用；FAIL 拦截、WARN 提示 |
| 项目禁词与祈使句 | 提交信息、AI 提示词 | `scripts/lib/tone.mjs`，commit-msg 调用 |

**oil-tone 已接入**：skill 装在 `~/.agents/skills/oil-tone`，来源 `github.com/oil-oil/oil-tone`。定位顺序是 `OIL_TONE_HOME` → 用户目录 → 仓库内，python 顺序是 `python` → `python3` → `py`；两者任一找不到就打印"文风检查跳过"，不阻塞提交——这是加分项，不是硬依赖。

两个实测踩到的坑记在 ADR-012：`tone_lint.py` 在 Windows 上输出 CRLF，按 `\n` 切行会让检查静默失效；规则文档里直接列出禁用词，会被自己的规则拦下，要用反引号包起来。

## 7. 出问题时

| 现象 | 处理 |
| --- | --- |
| 提交被拦，但认为误报 | 看清提示的规则条目；确需绕过用 `git commit --no-verify`，并在 PR 里说明 |
| `hooks 没生效` | `npm run hooks:install`，再 `git config --get core.hooksPath` 应为 `.githooks` |
| 提示找不到 node | 钩子会读 `.githooks/.node-path`；重跑 `hooks:install` 会重写它 |
| 沉淀没反应 | 看 `.ffshift/logs/sync.log`；AI 部分失败不影响前三条 |
| 历史里出现一串 `docs: 自动沉淀` | 机器提交递归触发沉淀（已修：`post-commit` 与 `sync-docs` 都会跳过自动沉淀提交）；旧历史保留不重写 |
| 沙箱验证报 EBUSY | 后台沉淀进程还占着临时目录，稍后手动删即可，不影响结论 |

## 8. 配置

`.ffshift/config.json` 是唯一开关入口：保护分支名单、体积上限、禁提交路径、禁词表、沉淀开关、AI 参数都在这里。改完不用重装钩子。

## 9. 远程侧保护

本机钩子只管这台机器。GitHub 上还要开分支保护（`scripts/remote-protection.json` + `gh api`，命令见 `docs/git-workflow.md` §5"远程仓库一次性设置"）。两边都开之后：本地提交被拦、远程推送被拒，规则才真正成立。
