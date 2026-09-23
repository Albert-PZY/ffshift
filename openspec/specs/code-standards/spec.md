# code-standards Specification

## Purpose

回答"这个项目的代码该怎么写"。它约束的是后续改动，而不是某个功能的行为：注释写为什么、纯逻辑与副作用怎么分、类型与空值怎么表达、错误怎么翻成人话、什么时候才允许引依赖、文件与命名怎么定。

这些规矩来自这个项目实际踩过的坑（见 `docs/decisions.md`、`docs/testing.md` 的失败记录），不是从别处抄来的风格指南。违反某条时，先想清楚是不是有更好的理由，再把理由记进决策记录。

## Requirements

### Requirement: 注释写"为什么"

代码 SHALL 用中文注释说明意图、权衡与反直觉之处；SHALL NOT 用注释复述代码本身。涉及非显而易见决定的注释，SHALL 说明原因，必要时指向决策记录。

#### Scenario: 绕过第三方库的反直觉行为

- **WHEN** 代码为了绕开某个反直觉行为而多写了一层处理
- **THEN** 注释写明那个行为是什么、为什么必须这样绕

#### Scenario: 一眼能读懂的代码

- **WHEN** 一段代码的含义从命名就能读出
- **THEN** 不加注释复述它，避免注释与代码一起腐烂

### Requirement: 纯逻辑与副作用分离

可测试的纯逻辑 SHALL 放在 `src/lib/`；进程调用、文件读写 SHALL 放在 `electron/`。`src/lib` SHALL NOT 在运行时依赖 Electron（类型引用可以）。

#### Scenario: 新增一段解析或计算

- **WHEN** 需要新增解析、格式化、参数构造之类的逻辑
- **THEN** 放进 `src/lib/` 并补单测；`electron/` 侧只负责调用与 IO

#### Scenario: 逻辑需要文件信息

- **WHEN** 纯函数需要文件大小、时间等外部信息
- **THEN** 由调用方读取后作为参数传入，而不是在纯函数里读文件

### Requirement: 类型的严格与一致

项目 SHALL 开启 `strict` 与 `noUncheckedIndexedAccess`。表示"未知 / 缺失" SHALL 统一用 `null`，SHALL NOT 与 `undefined` 混用表达同一含义。SHALL NOT 使用 `any` 接收外部数据。

#### Scenario: 解析外部数据

- **WHEN** 解析来路不明的数据（ffprobe 的 JSON、模型的输出）
- **THEN** 用 `unknown` 接收并逐字段校验，校验失败返回明确结果或抛出可翻译的错误

#### Scenario: 数组取值

- **WHEN** 按下标访问数组元素
- **THEN** 显式处理可能为空的情况，不靠 `!` 断言掩盖

### Requirement: 错误要能被人看懂

面向用户的错误 SHALL 翻译成可行动的中文提示；无法归类的错误 SHALL 保留原始输出摘要供排查。SHALL NOT 用"操作失败"这类无信息量的兜底文案。

#### Scenario: 转换失败

- **WHEN** ffmpeg 以非零退出码结束
- **THEN** 界面显示人话原因与下一步建议，原始输出可在日志里展开

#### Scenario: 取消不是失败

- **WHEN** 用户主动取消任务
- **THEN** 按"已取消"处理并清理半成品，不报告成错误

### Requirement: 不轻易引入依赖

新增依赖前 SHALL 先确认标准库或现有依赖做不到；确认要引入时 SHALL 在决策记录里写明理由与代价。

#### Scenario: 需要一个工具函数

- **WHEN** 只是需要一个哈希、一次格式化、一个颜色转换
- **THEN** 优先手写小函数，而不是拉一个包进来

### Requirement: 命名与文件职责

文件名 SHALL 用 kebab-case；类型用 PascalCase，函数与变量用 camelCase。一个文件 SHALL 只承担一件事，不为省文件把无关功能塞在一起。

#### Scenario: 新增模块

- **WHEN** 需要新增一个模块
- **THEN** 按职责命名文件；职责说不清时先拆清楚再动手
