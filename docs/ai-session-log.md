# AI 协作会话总结 · FFShift

> 用途：记录与 AI 工具（Cursor / Claude Code 等）的每次协作——做了什么、怎么验证、采纳与否决了什么。
> 对应笔试题第 4 条。规则：每天收工前 10 分钟记一条，只写事实，不超过 6 行。
> 本文件当前记录的是**文档阶段**的会话；开发阶段按模板继续追加。

## 模板（开发阶段复制使用）

- **日期 / 会话**：
- **目标**：本次要完成什么
- **关键提问**：向 AI 提了什么（可复用的提示词）
- **结果**：产出物（文件 / 代码 / 文档）
- **验证**：怎么验证的（命令、测试、实测）
- **采纳 / 否决**：留下什么、砍了什么、为什么
- **反馈**：事后发现的问题与调整

---

## 2026-09-22 · 会话 1：竞品调研 + 命名 + 架构文档

- **目标**：看清市场、定名字、产出可执行的架构与选型文档
- **关键提问**：a) 盘点同类产品与普遍痛点；b) 做命名查重（GitHub API + 搜索）；c) 产出多方案选型对比表
- **结果**：`docs/architecture.md`（竞品 17 项、命名表、10 张选型表）；项目名 **FormatShift**（2026-09-22 晚些时候改选 FFShift，见会话 4）
- **验证**：名称查重实测——VidPilot / FrameShift / VidMorph / FFmate / VidGenie / VidCraft 均已被占用；FormatShift 无同名产品
- **采纳 / 否决**：采纳 FormatShift；否决 VidBridge 等 6 个候选；否决"在线转码"方向（放弃本地/隐私优势）
- **反馈**：初版主选 Tauri 2，后被"稳定 + 低维护"要求推翻（见会话 3）

## 2026-09-22 · 会话 2：界面方向重做（高级极简）

- **目标**：把 UI 从"能用"改成"高级极简、体验优先、直观清晰"
- **关键提问**：a) 让 ui-ux-pro-max 出设计方向；b) 要求减少颜色与装饰，单一强调色
- **结果**：`design-system/ffshift/MASTER.md` 重写；架构文档 §7 更新（反白主按钮、明确不做清单、§7.4 自检 8 条）
- **验证**：检索 4 组配色（亮色奢侈品 / 橙蓝 / 绿暗色 / 中性亮色）均不匹配，确认数据集无现成条目后按 Minimalism & Swiss 约束自定义，并在 MASTER 中标注来源与调整
- **采纳 / 否决**：采纳"近中性暗色 + 单强调色 + 反白主按钮"；否决橙+蓝双色方案、否决滚动动效
- **反馈**：背景定为近黑 `#0B0C0E`（避免纯黑与系统标题栏割裂）

## 2026-09-22 · 会话 3：按"稳定 + 低维护"复核全部选型

- **目标**：需求方补充"生产级要稳定、维护成本低"，复核所有技术选型
- **关键提问**：a) 按"生态成熟度 / 维护面 / 交接成本"重排桌面框架；b) 把这条要求固化成文档原则
- **结果**：主选 Tauri 2 → **Electron**；WPF 升为并列候选；新增 §4.10 选型原则与 ADR-008；架构图、目录结构、排期检查点、风险表、验收清单全部对齐
- **验证**：全文检索确认无残留旧主选表述；决策变化写入 ADR-001"反馈"列
- **采纳 / 否决**：采纳 Electron 主选；否决"仍以 Tauri 为主、Electron 兜底"的折中方案
- **反馈**：体积/内存代价写入面试话术（"这个取舍我们认"），不回避

---

## 2026-09-22 · 会话 4：项目改名（FormatShift → FFShift）

- **目标**：需求方要求名字更极客、更方便记忆
- **关键提问**：a) 出极客风候选并逐个查 GitHub 占用；b) 给出可直接对比、可直接选的选择清单
- **结果**：改选 **FFShift**（仓库 `ffshift`，Slogan"ffmpeg 的换挡键"）；架构文档 §0/§2、ADR-006、本文件与设计系统目录全部同步
- **验证**：GitHub API 实时查重——FFShift 仅 1 个无关同名项目（FFShifter 手柄模拟器）；备选 FFPilot / Transcodr / VidMogrify / FFSmith / FFPipe / FFForge 均可用并留档
- **采纳 / 否决**：采纳 FFShift；否决 VidPipe（225 star 同类工具）、Remux（549 star + 行业通用词）、Molt / Smelt（同名数千）、VidMagick（与手机 App "VidMagic" 读音相同）
- **反馈**：旧名 FormatShift 作为历史保留在 §2 与 ADR-006 中，不删除记录；项目目录同步改名为 `ffshift`

---

## 2026-09-22 · 会话 5：补 Git 提交与协作规范（题 5）

- **目标**：把"提交到 GitHub"从凭感觉变成可执行规范，让面试官翻历史能看懂
- **关键提问**：a) 核实 GitHub 官方到底有没有提交信息格式要求；b) 区分官方要求与社区惯例
- **结果**：`docs/git-workflow.md`（area 对照表、粒度规则、分支与 PR、仓库红线、Release 标签分类、AI 参与标注）
- **验证**：逐页溯源核对——GitHub flow / Commits / 行尾处理 / 大文件（50 MiB 警告、100 MiB 拒收）/ 自动 Release Notes（只认 PR 标签，不认 commit 前缀）；提交信息写法以 git 项目 `SubmittingPatches` 为准
- **采纳 / 否决**：采纳 area 前缀风格（不用 Conventional Commits 前缀）；否决"提交 ffmpeg 二进制"（逼近 100 MiB 红线，改走 Release 附件）；否决把 `feat:`/`fix:` 说成"GitHub 官方要求"
- **反馈**：确认 GitHub 无强制提交格式，文档第 1 节即澄清，避免面试时讲错

---

## 2026-09-22 · 会话 6：生产级仓库规范落地（分支模型 + 钩子 + OpenSpec）

- **目标**：把规范从"写下来"变成"拦得住"——分支模型、提交校验、文档自动沉淀、OpenSpec 初始化
- **关键提问**：a) 设计一套 3 天单人也能用得住的分支与 PR 流程；b) 划清"自动写"与"AI 出草稿"的边界；c) 用本机 LLM 接口做沉淀，怎么防止污染权威文档
- **结果**：`docs/automation.md`、`docs/writing-style.md`、`.githooks/`（4 个钩子）、`scripts/`（钩子实现 + 沉淀 + 验证）、`openspec/` 初始化（zh-CN，五套 AI 工具指令）、`docs/git-workflow.md` 补分支与 Tag 章节；新增 ADR-009 ~ 012
- **验证**：`npm run hooks:verify` 16 条用例全绿（main 直提/直推被拦、无 area/空话/无正文/句号被拦、密钥与大文件被拦、规范提交放行、沉淀幂等）；LLM 接口实测 1.4s 返回
- **采纳 / 否决**：采纳 Git Flow 之外的 GitHub flow + 强制 PR；否决"让 AI 直接改 decisions.md 与 specs"（会污染权威文档）；否决等待 oil-tone（本机不存在，改为可执行的文案契约）
- **反馈**：密钥扫描先拦到了自己的验证脚本（样例 key 落进仓库），改成拼接字符串而不是放宽规则——这条经验写进了 `docs/automation.md`

---

## 开发阶段待办（提前列出，避免遗漏）

- 骨架跑通后记一条：实际用时的偏差（对照 §9.1 排期）
- 每完成一个模块：按模板追加；重点记录"AI 给的方案被否决/返工"的情况——这是面试官最想看的

---

## 2026-09-23 · 会话 7：从零实现应用主体（全程测试先行）

- **目标**：按排期把 lib 纯函数、主进程 ffmpeg 集成、界面、AI 助手与打包做完，每一步都先有测试再写实现
- **关键提问**：a) 边界与异常输入各要覆盖哪些；b) ffprobe 对损坏文件到底是什么行为（不猜，直接实测）；c) 模型输出不可靠时链路怎么兜底
- **结果**：`src/lib/` 八个纯函数模块、`electron/`（main / preload / ipc / ai / settings 与 ffmpeg 三件套）、React 界面、Windows NSIS 安装包（106.9 MB）
- **验证**：单测 117 条、集成测试 15 条（真实 ffmpeg）、端到端自检三条路径（模型守格式 / 给散文 / 完全不可用）、打包版 exe 实跑 896ms 完成转换
- **采纳 / 否决**：采纳 vitest 而非 node:test（TS 开箱可用）；否决 Tailwind（记 ADR-013）；否决"直接相信模型的 JSON 输出"，改为白名单校验 + 散文提取 + 规则降级三层
- **反馈**：三个实测结果与直觉相反——ffprobe 对垃圾数据不报错、模型不理会"只输出 JSON"、目标体积该取用户说的数字而不是模型分析里的

---

## 2026-09-23 · 会话 8：内置 ffmpeg，并按同类工具补全转换能力

- **目标**：让安装包自带 ffmpeg；对照 flyingmouse-format 补全视频格式转换
- **关键提问**：a) 同类工具（6157 star）在音视频转换上做了哪些处理；b) 带透明通道的素材转 yuv 编码会出什么问题
- **结果**：ffmpeg/ffprobe 随包分发（安装包 107 → 160 MB）；新增音频输出（mp3 / m4a / opus / flac / wav）、GIF（调色板两遍法）、透明素材合成、时长兜底；新增 code-standards 能力（6 条要求）
- **验证**：单测 165 条、集成测试 22 条全绿；alpha 合成取第一帧像素验证（白底叠加后绿分量 > 80）；打包版实测提取 MP3 用时 88ms
- **采纳 / 否决**：采纳"带 alpha 先合成底色"与调色板两遍法（都是对照项目的实战经验）；否决让用户自备 ffmpeg；否决把 GIF 滤镜链与 alpha 合成混用
- **反馈**：改功能时漏升版本号，出现同一版本号两种安装包内容——补升 1.1.0 并重发 Release。教训是发布前该跑一次版本一致性检查

---

## 提交流水（自动生成）

> 由 post-commit 钩子自动追加：只记事实（分支、提交、摘要、验证、文件数）。人工总结写在上面的会话记录里。

| 时间 | 分支 | 提交 | 摘要 | 验证 | 文件数 |
| --- | --- | --- | --- | --- | --- |
| 09-23 03:05 | chore/repo-bootstrap | `82bf7d4` | chore: 建立仓库骨架与工程规范 | npm run hooks:verify 16 条用例全绿 | 77 |
| 09-23 03:07 | chore/repo-bootstrap | `3909247` | docs: 沉淀骨架提交的产物并纳入状态页 | — | 3 |
| 09-23 03:07 | chore/repo-bootstrap | `33fd66d` | docs: 沉淀骨架提交的产物并纳入状态页 | — | 3 |
| 09-23 03:07 | chore/repo-bootstrap | `cd2b424` | chore: 沉淀产物支持自动提交 | 观察本次提交后是否自动产生一条 docs: 自动沉淀 提交 | 3 |
| 09-23 03:08 | chore/repo-bootstrap | `8d5768b` | docs: 自动沉淀 cd2b424 | — | 2 |
| 09-23 03:08 | chore/repo-bootstrap | `61e96d9` | docs: 自动沉淀 8d5768b | — | 2 |
| 09-23 03:08 | chore/repo-bootstrap | `2e7cc10` | docs: 自动沉淀 61e96d9 | — | 4 |
| 09-23 03:08 | chore/repo-bootstrap | `5971f4c` | chore: 加上远程分支保护配置与 Release 分类 | gh api 命令待推送后执行，届时用 --jq 复查返回值 | 2 |
| 09-23 03:08 | chore/repo-bootstrap | `29dd103` | docs: 自动沉淀 5971f4c | — | 2 |
| 09-23 03:09 | chore/repo-bootstrap | `d568a93` | docs: 自动沉淀 2e7cc10 | — | 2 |
| 09-23 03:09 | chore/repo-bootstrap | `01c3d58` | tool: 断掉自动沉淀提交的递归触发 | 提交后只应新增一条自动沉淀记录，且不再级联 | 6 |
| 09-23 03:23 | chore/repo-bootstrap | `22854bb` | tool: 接入 oil-tone 文风检查到提交钩子 | 探针提交被正确拦下；docs 下 8 份文档全量 PASS | 8 |
| 09-23 03:23 | chore/repo-bootstrap | `0cef19e` | tool: 分支保护对管理员同样生效 | — | 1 |
| 09-23 03:25 | docs/readme | `8815d08` | docs: 补 README，写清现状与上手方式 | oil-tone 对 README 报 PASS；hooks:verify 保持 16 条全绿 | 1 |
| 09-23 03:28 | tool/branch-policy | `bdc0c71` | tool: 补上分支命名检查并修掉沉淀两处缺陷 | hooks:verify 17 条用例全绿 | 10 <!-- commit:bdc0c71 --> |
| 09-23 03:39 | feat/app-skeleton | `158f82a` | tool: 建立 TDD 链路与提交前单测关卡 | npm run test:unit 通过；钩子实际拦下过未通过的单测 | 5 <!-- commit:158f82a --> |
| 09-23 03:39 | feat/app-skeleton | `7ccad2d` | lib: 实现四个纯函数模块（含测试） | npm run test:unit → 4 个文件 51 条用例通过 | 8 <!-- commit:7ccad2d --> |
| 09-23 03:41 | feat/app-skeleton | `2b976c7` | lib: 补 ffprobe 解析与缩略图缓存键 | npm run test:unit → 6 个文件 70 条用例通过 | 7 <!-- commit:2b976c7 --> |
| 09-23 03:43 | feat/app-skeleton | `2706be3` | media: 接入 ffprobe 与可转换性判断 | 单测 76 条、集成测试 6 条（含中文空格路径、截断文件、垃圾数据）全绿 | 8 <!-- commit:2706be3 --> |
| 09-23 03:46 | feat/app-skeleton | `4b4f10a` | media: 加上缩略图抽帧与转换引擎 | 单测 87 条、集成测试 15 条（真实转码、取消、目标体积、缓存命中）全绿 | 13 <!-- commit:4b4f10a --> |
| 09-23 03:50 | feat/app-skeleton | `91a247a` | main: 搭起 Electron 应用骨架与 IPC 白名单 | 构建通过；冒烟自检窗口正常；端到端自检完成探测到转换全链路（799ms） | 8 <!-- commit:91a247a --> |
| 09-23 03:50 | feat/app-skeleton | `36e4c13` | ui: 按设计系统实现列表与队列界面 | typecheck 通过；构建产物能正常加载 | 5 <!-- commit:36e4c13 --> |
| 09-23 12:08 | feat/app-skeleton | `a435dbb` | ai: 接入参数建议，模型不守格式时也能给出结果 | 单测 109 条（含 20 条 AI 用例）；端到端自检把三种路径都跑过 | 11 <!-- commit:a435dbb --> |
| 09-23 12:11 | feat/app-skeleton | `9daba8f` | settings: 记住档位与输出目录 | 单测 117 条（含 8 条设置解析用例） | 7 <!-- commit:9daba8f --> |
| 09-23 12:14 | feat/app-skeleton | `5d32cf3` | build: 配上 Windows 打包与图标 | npm run package 出包成功；打包后的 FFShift.exe 冒烟与端到端都通过 | 4 <!-- commit:5d32cf3 --> |
| 09-23 12:14 | feat/app-skeleton | `685b344` | ai: 采纳建议时把目标体积一起带上 | typecheck 与 117 条单测通过；构建正常 | 2 <!-- commit:685b344 --> |
| 09-23 12:16 | feat/app-skeleton | `a7e4189` | docs: 补上开发期的测试记录与会话总结 | 两份文档都通过 oil-tone 检查 | 2 <!-- commit:a7e4189 --> |
| 09-23 12:18 | feat/app-skeleton | `3917597` | docs: 加一张自动生成的真实界面截图 | 截图来自最新构建，内容为真实界面（AMF 加速、1280×720、5 秒素材） | 4 <!-- commit:3917597 --> |
| 09-23 12:18 | feat/app-skeleton | `8023deb` | ui: 转换完成后可以直接打开输出目录 | typecheck 通过；端到端自检回归正常 | 6 <!-- commit:8023deb --> |
| 09-23 12:18 | feat/app-skeleton | `d2b5c5f` | build: 锁定 electron-builder 的依赖树 | npm ls electron-builder 与 lock 一致 | 1 <!-- commit:d2b5c5f --> |
| 09-23 12:21 | build/v1.0.0 | `baeb4ba` | tool: 分支前缀白名单补上 build/ | 改完后 build/ 开头的分支可以正常提交 | 3 <!-- commit:baeb4ba --> |
| 09-23 12:21 | build/v1.0.0 | `6cdee87` | tool: 分支前缀白名单补上 build/ | 改完后 build/ 开头的分支可以正常提交 | 2 <!-- commit:6cdee87 --> |
| 09-23 12:21 | build/v1.0.0 | `2f15513` | build: 版本号升到 1.0.0，与首个正式交付对齐 | 重新打包后产物名为 FFShift-1.0.0-setup.exe | 1 <!-- commit:2f15513 --> |
| 09-23 13:11 | feat/output-format | `180cc93` | convert: 支持选择输出格式，编码跟随容器 | 单测 139 条、集成测试 18 条全绿；端到端实测 mp4 转 webm 产出 VP9 + Opus | 13 <!-- commit:180cc93 --> |
| 09-23 13:15 | main | `1b0019f` | convert: 支持选择输出格式，编码跟随容器 (#8) | 单测 139 条、集成测试 18 条全绿；端到端实测 mp4 转 webm 产出 VP9 + Opus | 22 <!-- commit:1b0019f --> |
| 09-23 13:16 | chore/tidy-structure | `b573e60` | docs: 设计系统文档并入 docs 并同步引用 | 脚本跑通、状态页正常刷新；全仓搜索无残留旧路径引用 | 5 <!-- commit:b573e60 --> |
| 09-23 13:16 | chore/tidy-structure | `84cfe61` | chore: 清掉已经多余的占位文件 | openspec validate 仍然通过 | 2 <!-- commit:84cfe61 --> |
| 09-23 13:31 | feat/ffmpeg-bundled-and-media | `5a7a57d` | build: 把 ffmpeg 与 ffprobe 内置进安装包 | 打包产物里有两个二进制；冒烟日志显示 ffmpeg 来源：随包分发 | 2 <!-- commit:5a7a57d --> |
| 09-23 13:31 | feat/ffmpeg-bundled-and-media | `447ae3d` | convert: 支持音频与 GIF 输出，透明素材先合成底色 | 单测 165 条、集成测试 22 条全绿；alpha 合成用取像素验证（白底叠加后绿分量 > 80） | 15 <!-- commit:447ae3d --> |
| 09-23 13:35 | feat/ffmpeg-bundled-and-media | `a227185` | docs: 补代码规范与新增转换能力的规格 | openspec validate 通过（3 个能力 0 失败）；README 通过 oil-tone 检查 | 13 <!-- commit:a227185 --> |
| 09-23 13:37 | docs/refresh-screenshot | `66d0cb1` | docs: 更新界面截图（格式下拉已按视频/动图/音频分组） | 截图为最新构建产出 | 1 <!-- commit:66d0cb1 --> |
| 09-23 13:55 | chore/version-and-cursor | `4f27c77` | tool: 移除 Cursor 的工具配置 | 其余三个工具目录未受影响，openspec 命令仍可用 | 14 <!-- commit:4f27c77 --> |
| 09-23 13:55 | chore/version-and-cursor | `534a908` | build: 版本号升到 1.1.0 | 重新打包后产物为 FFShift-1.1.0-setup.exe | 1 <!-- commit:534a908 --> |
| 09-23 14:16 | docs/ui-spec | `dfe6429` | docs: 加一份交给 v0.app 的界面规格 | 文档通过 oil-tone 检查 | 1 <!-- commit:dfe6429 --> |
| 09-23 15:01 | feat/ui-refresh | `6503cad` | ui: 按 v0.app 的三栏布局重构界面 | typecheck 通过；单测 165 条全绿；端到端实测转换成功（837ms） | 6 <!-- commit:6503cad --> |
| 09-23 15:03 | chore/bump-1.2.0 | `4554b15` | build: 版本号升到 1.2.0 | 重新打包后产物为 FFShift-1.2.0-setup.exe | 1 <!-- commit:4554b15 --> |
| 09-23 15:17 | feat/settings-and-folder | `165f0fb` | ui: 补上输出目录、目标体积与文件夹导入 | 单测 172 条全绿、typecheck 通过、界面截图已更新 | 11 <!-- commit:165f0fb --> |
| 09-23 15:22 | feat/settings-and-folder | `f6840ff` | ui: 失败的原始日志可展开复制，连续失败两次就停下 | 单测 172 条、集成测试 22 条全绿（新增断言：失败时 error.raw 非空） | 4 <!-- commit:f6840ff --> |
| 09-23 15:24 | feat/settings-and-folder | `2d13d18` | ui: 转换完成后发系统通知，并显示体积变化 | typecheck 通过；端到端实测 outputSizeBytes = 2311319（约 2.3 MB） | 7 <!-- commit:2d13d18 --> |
| 09-23 15:37 | docs/spec-and-testing | `51f33b5` | docs: 把八项功能写进规格，并更新测试清单 | openspec validate 通过（3 个能力、0 失败） | 5 <!-- commit:51f33b5 --> |
| 09-23 16:12 | feat/advanced-params | `afd7fd9` | convert: 专业参数的数据层、校验与参数构造 | 单测 222 条全绿（新增 42 条：校验 27、构造 15） | 11 <!-- commit:afd7fd9 --> |
| 09-23 16:13 | feat/advanced-params | `61ab1df` | test: 预设层的边界用例 | 单测 237 条全绿（新增 15 条） | 1 <!-- commit:61ab1df --> |
| 09-23 16:19 | feat/advanced-params | `7744e61` | ui: 专业参数面板 | typecheck 通过、单测 237 条全绿、端到端回归成功、两张截图已生成 | 5 <!-- commit:7744e61 --> |
| 09-23 16:24 | docs/params-spec | `dbc2862` | docs: 把专业参数写进规格，并更新测试清单 | openspec validate 通过（4 个能力、0 失败） | 5 <!-- commit:dbc2862 --> |
| 09-23 18:51 | test/e2e-suite | `2c4110f` | test: 真正的端到端测试（9 条，驱动真实界面） | e2e 9 条全绿（29.7s）、typecheck 通过 | 8 <!-- commit:2c4110f --> |
| 09-23 18:51 | test/e2e-suite | `2bb53a4` | docs: 把 e2e 的结果写回测试清单 | — | 3 <!-- commit:2bb53a4 --> |
| 09-23 18:53 | docs/e2e-status | `7fabda2` | docs: 把 e2e 的结果写回测试清单 | — | 1 <!-- commit:7fabda2 --> |
| 09-23 19:06 | docs/e2e-hook | `3b78307` | docs: 把端到端测试的分工与钩子位置写进文档 | 钩子自测 18 条、端到端 9 条全绿 | 3 <!-- commit:3b78307 --> |
| 09-23 19:38 | refactor/ui-enso-language | `6fe2c37` | build: 接入 Tailwind v4 与 Base UI | npm run build 通过（渲染层产出 55KB CSS） | 7 <!-- commit:6fe2c37 --> |
| 09-23 19:39 | refactor/ui-enso-language | `fcda2bd` | lib: 抽出状态、格式与版本号的纯函数 | 单测 251 条全绿（新增 14 条） | 9 <!-- commit:fcda2bd --> |
| 09-23 19:39 | refactor/ui-enso-language | `2ac2616` | ui: 移植 UI 原语层 | typecheck 通过 | 17 <!-- commit:2ac2616 --> |
