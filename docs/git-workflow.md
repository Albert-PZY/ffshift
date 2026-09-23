# Git 提交与协作规范 · FFShift

> 对应笔试题第 5 条（项目提交 GitHub）。目的只有一个：让面试官打开 `git log` 能看懂你做了什么、按什么节奏做的。
> **本文不是倡议**：分支保护、提交信息校验、密钥与大文件拦截、文档自动沉淀都已由 git 钩子落地，机制见 `docs/automation.md`。
> 依据分三类，全文逐条标注：
> - **【GitHub】** GitHub 官方文档：GitHub flow、Commits、行尾处理、大文件、自动生成 Release Notes
> - **【git】** git 项目自己的提交规范 `SubmittingPatches`（Linux 内核一脉，最权威的提交信息规范）
> - **【惯例】** 社区约定，**不是**官方要求（如 Conventional Commits）
> 链接见文末。

## 1. 先纠正一个误解

**GitHub 没有强制的提交信息格式。** 官方只给原则（短、说得清、一个提交一件事）；`feat:` `fix:` 这类前缀来自社区的 Conventional Commits，GitHub 既不解析也不校验——它的自动 Release Notes **只认 PR 标签**，不认提交前缀（§7）。

| 说法 | 是不是官方 | 出处 |
| --- | --- | --- |
| 每个提交应是"完整、孤立"的一件事 | ✅ GitHub | GitHub flow |
| 提交信息要简短描述改了什么 | ✅ GitHub | Commits |
| 首行 ≤50 字符、祈使句、结尾不加句号、`area:` 前缀 | ✅ git 项目 | SubmittingPatches |
| 正文写"为什么改"，含考虑过但放弃的方案 | ✅ git 项目 | SubmittingPatches |
| 拒绝 AI 味、作者自己都讲不清的提交 | ✅ git 项目 | SubmittingPatches · AI 一节 |
| `feat:` / `fix:` 前缀、类型表 | ❌ 社区惯例 | Conventional Commits |

一句话：**格式可以自选，"一个提交一件事 + 说得清为什么"不能省。**

## 2. 提交信息格式

```
media: 用 ffprobe 解析并显示视频信息

导入后原先只有文件名，用户不知道时长和分辨率，选参数全靠猜。
改为并发（≤3）调用 ffprobe 解析 JSON，只取能帮用户判断的字段。

验证：三种格式各导入一次；media 解析单测通过

Refs: ADR-003
```

| 部分 | 规则（来源） |
| --- | --- |
| 首行 | ≤50 字符软限制、**祈使句**、结尾不加句号、`area: ` 前缀、冒号后首词小写（【git】） |
| 第 2 行 | 必须空一行，否则 git 会把正文当标题的一部分（【git】） |
| 正文 | 写**为什么**（现状的问题 → 改后为什么更好 → 考虑过但放弃的替代方案）；描述现状用现在时（【git】） |
| 尾注 | 一行一个：`Refs: ADR-00X`、`Closes #12`（合并后自动关 issue，【GitHub】）、`Co-authored-by:`（【GitHub】） |

**祈使句** = 把首行读成"给代码下命令"：

- ✅ `queue: 取消时结束 ffmpeg 进程并清理半成品`
- ❌ `queue: 修复了取消残留的问题`（过去式）/ `This commit fixes…`（叙述式）

本项目统一用中文写首行，`area` 用英文（对齐目录，见 §3）。

**中文的落地调整**：官方的 50 字符是给英文的；中文一个字占两格，首行建议压到 **25 字以内**（GitHub 提交列表超出会截断）。

## 3. area 固定表（对齐 §5.3 目录，不许自创）

| area | 对应 |
| --- | --- |
| `media` | `src/features/media`：导入、ffprobe 信息、缩略图 |
| `convert` | `src/features/convert`：预设、参数构造、任务引擎 |
| `queue` | `src/features/queue`：队列列表、进度、取消、重试 |
| `settings` | `src/features/settings`：输出目录、并发、Key |
| `lib` | `src/lib`：纯函数（参数、进度解析、错误翻译、格式化） |
| `ui` | `src/components`、样式、设计系统落地 |
| `main` | `electron/`：窗口、托盘、对话框、子进程托管 |
| `docs` | `docs/`、`README.md` |
| `test` | 测试代码、`scripts/gen-fixtures.ps1` |
| `tool` | 钩子与自动化脚本（`.githooks/`、`scripts/`）、工程配置 |
| `build` | 依赖、打包配置（electron-builder、`package.json`） |
| `chore` | `.gitignore`、格式化等杂项 |

为什么不用 `feat/fix` 类型前缀：area 与目录一一对应，面试官不用查表就知道你动了哪块。若你更习惯 Conventional Commits（【惯例】，可用），**别两种混用**。

## 4. 提交粒度（官方写得很直白）

> "Ideally, each commit contains an isolated, complete change." ——【GitHub】GitHub flow

官方给的例子：重命名变量 + 加测试，就应该是两个提交——这样想只回滚重命名时，测试能留下。

| ✅ 该拆 | ❌ 别这样 |
| --- | --- |
| `media: 接入 ffprobe` / `test: 补信息解析单测` | `更新`（信息量为零） |
| `lib: 抽离进度解析为纯函数` / `test: 覆盖异常块` | `改了点东西` |
| `docs: 补 ADR-003 反馈` 与代码提交分开 | `feat: 全部功能完成`（混了 5 件事） |

三条硬规则：

1. **不推 `wip`**：没写完就本地 `stash` 或下一次 `--amend`；
2. **不混格式化**：顺手全局格式化会淹没有效 diff，单独一个 `chore:` 提交；
3. **提交要能编译**：每个提交至少保证 `npm run build` 不炸，否则 bisect 没意义。

## 5. 分支模型（强制，不是建议）

**唯一长期分支是 `main`，它是可交付状态。** 任何改动都必须经过"功能分支 → PR → 合并"这条路，不允许直接写 `main`。

| 规则 | 怎么落地 |
| --- | --- |
| `main` 上不能直接提交 | 本机 pre-commit 钩子拦截；远程开分支保护后 GitHub 也会拦 |
| 不能直接推 `main` | 本机 pre-push 钩子拦截（`refs/heads/main` 一律拒绝） |
| 按模块开分支，一个分支一件事 | 分支名 = `<前缀>/<模块>-<动作>`，模块名取自 §3 的 area 表 |
| 合并只能由 PR 完成 | GitHub 上开 PR、自己 review、Squash 合并 |
| 合并后删分支 | 历史留在 PR 里，本地 `git branch -d` |

分支前缀：`feat/`（新功能）`fix/`（修缺陷）`refactor/` `test/` `docs/` `chore/` `tool/`（脚本与钩子）`build/`（依赖与打包）。
示例：`feat/media-probe`、`feat/convert-presets`、`fix/queue-cancel-leftover`、`docs/readme`。
前缀白名单在 `.ffshift/config.json`，`pre-commit` 会实际检查——分支名不合规范提交不上去。
白名单要与 §3 的 area 表一一对应：新增 area 时同步加分支前缀（`build/` 就是这样补上的）。

### 标准动作（照抄）

```bash
# 1) 从最新的 main 开分支
git switch main && git pull --ff-only
git switch -c feat/media-probe

# 2) 开发、频繁提交（钩子自动校验信息 / 拦截密钥与大文件）
git add -A && git commit

# 3) 推送功能分支（main 推不上去，钩子会拦）
git push -u origin feat/media-probe

# 4) GitHub 开 PR → 打标签（enhancement / bug / docs）→ Squash 合并

# 5) 本地同步并清理
git switch main && git pull --ff-only && git branch -d feat/media-probe
```

【GitHub】官方 GitHub flow 就是这套：建分支 → 改动提交 → 开 PR → 处理评审 → 合并 → 删分支。官方对提交粒度还给了明确例子：重命名变量和加测试应该是两个提交，这样只回滚重命名时测试能留下。

**PR 描述写三件事**：改了什么 / 解决什么问题 / 怎么验证的。用 `Closes #12` 关联 issue，合并时自动关闭（【GitHub】）。

**为什么单人项目也要这么做**：面试官看的是"你有没有工程习惯"，不是"你有没有同事"。一条直线的 `main` 说明不了任何事；两三个 PR + 分支名 + 合并记录能说明协作意识。

### 逃生舱（仅限紧急，用完补 PR）

```bash
FFSHIFT_ALLOW_MAIN_COMMIT=1 git commit ...   # 允许在 main 上提交
FFSHIFT_ALLOW_MAIN_PUSH=1 git push origin main
```
用之前先问自己：是不是因为偷懒？用了就在 `docs/decisions.md` 记一条。

### 远程仓库一次性设置（只做一次）

本机钩子只能管住你这台机器；GitHub 侧要再上一道锁。

```bash
# 1) 首次建立主干：把本地 main 推上去（唯一一次直推 main）
git push -u origin main

# 2) 打开分支保护：main 必须经 PR，禁止强推与删除，要求线性历史
gh api -X PUT repos/Albert-PZY/ffshift/branches/main/protection \
  --input scripts/remote-protection.json

# 3) 确认
gh api repos/Albert-PZY/ffshift/branches/main/protection --jq '.required_pull_request_reviews'
```

`required_approving_review_count: 0` 是给单人项目用的：**必须有 PR 流程，但不强制别人批准**（否则自己永远合不进去）。做完这一步，`main` 在本地和远程都推不动了。

## 6. 仓库红线（本项目踩坑点，务必照做）

| 项 | 规则 | 依据 |
| --- | --- | --- |
| 单文件大小 | >50 MiB 警告、**>100 MiB 直接拒收** | 【GitHub】 |
| 仓库体积 | 建议 <1 GB，强烈建议 <5 GB | 【GitHub】 |
| 大二进制 | **走 Release 附件分发，不要提交进仓库** | 【GitHub】 |
| 误提交大文件 | 未推送：`git rm --cached` + `git commit --amend -CHEAD`；已推送：`git filter-repo`（不可逆，先备份） | 【GitHub】 |
| 行尾 | 提交 `.gitattributes`（覆盖所有人的 `core.autocrlf`，保证一致） | 【GitHub】 |
| 空白错误 | 提交前 `git diff --check` | 【git】 |

**本项目的三条具体禁令：**

1. **不提交 ffmpeg / ffprobe 二进制**——单个约 70–80 MB，逼近 100 MiB 红线，且会让克隆变慢。放 Release 附件，或写下载脚本；
2. **不提交测试视频**——用 `scripts/gen-fixtures.ps1` 现场生成（lavfi，不下载、不进仓库）；
3. **不提交 LLM API Key**——按 ADR-005，Key 只存本机；`.env` 进 `.gitignore`，`.env.example` 可以提交。

`.gitignore` 起步内容：`node_modules/`、`dist/`、`out/`、`release/`、`*.log`、`.env`、`fixtures/`、`*.exe`。

`.gitattributes` 起步内容（【GitHub】模板改）：

```
* text=auto
*.ps1 text eol=crlf
*.bat text eol=crlf
*.png binary
*.jpg binary
*.exe binary
```

> 生效后若发现一堆"没改过的文件被改动"：`git add --renormalize .` 再提交一次（【GitHub】）。

## 7. 版本与 Release

### 什么时候打 tag

**只有"能演示的状态"才配打 tag**——半成品打 tag 等于自己也说不清哪个版本能跑。判定标准：能不能当众演示这条链路而不解释"这里还没做"。

| Tag | 里程碑（对照 §9.1 排期） | 打之前必须成立 |
| --- | --- | --- |
| `v0.1.0` | 仓库规范就位 | 文档四件套 + hooks + OpenSpec 初始化，能开工 |
| `v0.2.0` | Day 1 收工 | 拖入视频能看到信息与缩略图，`lib/` 单测过 |
| `v0.3.0` | Day 2 收工 | 批量转换跑通，取消/重试可用，错误能翻译成人话 |
| `v1.0.0` | Day 3 提交前 | 干净机器装包可用 + README 有截图 + docs 齐全 |

### 怎么打

```bash
git switch main && git pull --ff-only      # tag 只打在 main 上
git tag -a v0.2.0 -m "Day1：媒体信息与缩略图可用"
git push origin v0.2.0                     # 推 tag 不受 main 保护限制
```

打 tag 走**注释标签**（`-a`，带说明），不要轻量标签——面试官点开能看到这一版到底到什么程度。

### Release

- **安装包放 Release 附件**，不进仓库：正好绕开 §6 的 100 MiB 限制（【GitHub】明确推荐用 Release 分发大二进制）。
- **自动 Release Notes 按 PR 标签分类**，不认提交前缀——所以**开 PR 时顺手打标签**。标签名必须与仓库实际存在的标签一致（`gh label list` 可查），写错等于不分类。GitHub 默认自带 `bug`、`enhancement`、`documentation`，本仓库按这三个配置：

```yaml
changelog:
  categories:
    - title: 新功能
      labels: [enhancement]
    - title: 修复
      labels: [bug]
    - title: 文档与规范
      labels: [documentation]
    - title: 其他
      labels: ['*']
```

- Release 正文只写人话：这一版能干什么、已知问题有哪些。

## 8. AI 参与的标注（本题考察点）

【git】`SubmittingPatches` 有专门一节讲 AI：明确会拒绝"像 AI 生成、过度正式、表面漂亮但说不通、作者自己都解释不了"的提交。对本次笔试，这条比格式更重要。

做法：

- 提交信息里的每一句，你都要能当面讲清；不写"优化了性能、提升了体验"这类空话；
- AI 大量参与的那次改动，在尾注标注（Claude Code 默认会加，形如 `Co-authored-by: Claude <noreply@anthropic.com>`；以你所用工具实际输出为准），**同时**在 `docs/ai-session-log.md` 记一条；
- 有 AI 味的信息宁可手改：你的目标是让面试官相信"代码是我理解过的"。

## 9. 三天节奏（对照 §9.1 排期）

| 时间 | 分支 | 提交节奏 |
| --- | --- | --- |
| Day 0 | `chore/repo-bootstrap` | 仓库规范 + 文档 + OpenSpec 初始化 → 合并后打 `v0.1.0` |
| Day 1 | `feat/media-*`（可拆多个） | 骨架 1 个提交，媒体信息、缩略图各自 3~5 个小提交；收工前 `docs: 记录会话 1`；合并后打 `v0.2.0` |
| Day 2 | `feat/convert-*`、`feat/queue-*` | 参数构造、执行、进度、取消、重试各一次提交；合并后打 `v0.3.0` |
| Day 3 | `feat/settings-*`、`chore/release-*` | 功能提交；`docs: 补测试记录`；打包、发 Release、打 `v1.0.0` |

反模式：一天一个 `day1: 全部完成`（暴露节奏失控）；几十个 `wip`（暴露没有整理习惯）；所有提交挤在 `main` 上（暴露不会协作）。

## 10. 提交前自检（5 秒版）

大部分条目已由钩子自动拦（见 `docs/automation.md`），这里是人要自己想的部分：

- [ ] 我现在在功能分支上，不是 `main`（钩子会拦，但别靠它）
- [ ] 首行够短（中文 ≤25 字）、祈使句、没句号
- [ ] 这个提交只做一件事
- [ ] 正文能回答"为什么"，不是我改了啥
- [ ] 没混进 `node_modules` / 大文件 / Key
- [ ] 涉及决策 → 同步 `decisions.md`；涉及测试 → 更新 `testing.md`；当天收工 → 写 `ai-session-log.md`（后两项已有自动草稿，人工确认后再采纳）

## 附：反例速查

| 别这么写 | 这么写 |
| --- | --- |
| `update` | `ui: 空态改为一句话 + 一个按钮` |
| `fix bug` | `queue: 取消后清理半成品输出文件` |
| `修复问题，优化代码，更新文档` | 拆成三个提交 |
| `feat: 功能完成` | `convert: 按容器选编码器并保留硬件加速` |
| `wip`（推上去了） | 别推；本地 stash 或 amend |

## 参考

- GitHub flow — https://docs.github.com/en/get-started/using-github/github-flow
- Commits（reference）— https://docs.github.com/en/pull-requests/reference/commits
- Writing code for a project — https://docs.github.com/en/pull-requests/concepts/writing-code-for-a-project
- 行尾处理 — https://docs.github.com/en/get-started/git-basics/configuring-git-to-handle-line-endings
- 大文件限制 — https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- 自动生成 Release Notes — https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes
- 关联 PR 与 issue — https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue
- git 提交规范 — https://git-scm.com/docs/SubmittingPatches
- Conventional Commits（社区惯例）— https://www.conventionalcommits.org/
