# Design System · FFShift

> 构建界面前先读本文件：颜色、字体、间距、动效、组件规范都在这里，界面实现以它为准。
> 上一版（v0.app 的三栏方案 + 四层底色）由本版整体替代，取舍过程见 `docs/decisions.md` ADR-015。

**来源与调整（如实标注）**

- 令牌体系、组件配方、排版尺度：内化自 [EnsoCode](https://github.com/J3n5en/EnsoCode)（MIT）的 `src/renderer/styles/globals.css` 与 `src/renderer/components/ui/`。逐条对照见下面各节。
- 风格立场（单一强调色、颜色只表达状态与唯一主按钮、禁渐变/发光/装饰插画）沿用 ADR-007，未被推翻。
- 三处刻意的偏离都有实测依据，逐条标在下面对应位置，不混进"参考"里。

## 设计立场

高级极简 = 更少的颜色、更少的装饰、更清楚的层级。
**颜色不参与分层**：层级用 1px 边框、半透明叠加、间距与字重表达；颜色只表达状态与唯一主按钮。

EnsoCode 把这条做到了极致，本项目直接跟进：

- 窗口、侧栏、工作区、详情栏**同一种底色**（`--background`），分隔只有 1px 边框；
- 嵌套块靠 `bg-muted/20`、`bg-muted/30`、`bg-muted/50` 这类**半透明叠加**分出深浅；
- 浮层（对话框、下拉、提示）用 `bg-popover`，配 1px 描边与一层软阴影；
- 强调不靠第二个颜色，而是靠 `--primary` 的**反白**：暗色下是近白底 + 深色字。

这样做的收益不是"好看"，而是**界面里每一个色块都在说一件事**。反过来，一旦允许用底色分区，后面的每次改动都会多一个"这里该用哪一级底色"的问题。

## 技术底座

| 项 | 选择 | 说明 |
| --- | --- | --- |
| 样式 | Tailwind CSS v4.3，CSS-first 配置 | 没有 `tailwind.config.js`，令牌与主题映射全在 `src/styles/globals.css` |
| 组件基座 | [Base UI](https://base-ui.com) 1.7（`@base-ui/react`） | **不是 Radix**。EnsoCode 用的是 Base UI，本项目照此对齐 |
| 变体与类名 | `class-variance-authority` + `tailwind-merge` + `clsx` | `src/lib/utils.ts` 的 `cn()`；不 merge 的话组件就失去了"可被外部覆盖"的能力 |
| 图标 | `lucide-react`，线性，1.5px 描边 | 禁止 emoji 当图标 |
| 字体 | 不打包字体文件 | `Inter` 命中系统就命中，否则退到 `system-ui`；与上游一致 |

## 全局 Token

### 颜色

单主题暗色（ADR-007 已定：不留亮色，少一半变量组合要维护）。
命名与取值来自 EnsoCode 的 `.dark` 段，逐字对照：

| Token | 值 | 用途 |
| --- | --- | --- |
| `--background` | `oklch(0.145 0.014 285.82)` | 窗口底、侧栏、工作区、详情栏、标题栏——**所有大面板** |
| `--foreground` | `oklch(0.985 0 0)` | 主文字 |
| `--card` / `--popover` | 同 `--background` | 卡片与浮层。暗色下与底同色，靠描边与阴影分层 |
| `--popover-foreground` | `oklch(0.985 0 0)` | |
| `--primary` | `oklch(0.985 0 0)` | **反白主按钮**。全屏只有一个（"开始转换"） |
| `--primary-foreground` | `oklch(0.205 0.014 285.82)` | |
| `--secondary` / `--muted` / `--accent` | `oklch(0.269 0.014 285.82)` | 三色同值：嵌套块底、行 hover / 选中、图标按钮 hover |
| `--muted-foreground` | `oklch(0.708 0.014 285.82)` | 说明、元信息（对底色 7.62:1） |
| `--destructive` | `oklch(0.704 0.191 22.216)` | 失败 / 不支持 / 破坏性操作 ⚠️ 见下方调整 ① |
| `--success` | `oklch(0.723 0.192 149.579)` | 已完成 ⚠️ 见下方调整 ① |
| `--warning` | `oklch(0.769 0.189 70.08)` | 已取消（与上游一致） |
| `--info` | `oklch(0.623 0.214 259.81)` | 排队中 / 转换中 / 进度条（与上游一致） |
| `--border` / `--input` | `oklch(0.269 0.014 285.82)` | 全部 1px 分隔与描边；也是输入框 32% 叠加的来源 |
| `--ring` | `oklch(0.439 0.014 285.82)` | 焦点环 |
| `--radius` | `0.5rem`（14px 基准下 = 7px） | 控件 7px / 小标签 5px / 小控件 5px，由 lg·md·sm 三档派生 |

中性色共用同一色相 `285.82`、彩度 ≤ 0.014（一个偏冷的极低彩度灰，等价于 shadcn 的 zinc）。
**色相不参与分层，层次完全来自明度**，所以界面里不会出现"暖灰混冷灰"。

**⚠️ 调整 ①：`destructive` 与 `success` 取更亮的一档。**
上游暗色用的是 `oklch(0.396 0.141 25.72)` 与 `oklch(0.527 0.154 150.07)`，那是配白字做**实心按钮**用的。
本项目把这两个颜色当**正文色**压在窗口底上，实测对比度只有 1.97:1 与 4.01:1，低于本项目 4.5:1 的硬线。
换成 0.704 / 0.723 后是 6.85:1 与 8.70:1（WCAG 相对亮度公式算出来的，不是估的）。改回去之前先量一遍。

状态色与状态的对应（颜色只做辅助，**文字必须同时表达**）：

| 状态 | 颜色 | Token |
| --- | --- | --- |
| 读取中 / 待转换 | 中性 | `--muted-foreground` |
| 排队中 / 转换中 | 蓝 | `--info` |
| 已完成 | 绿 | `--success` |
| 已取消 | 琥珀 | `--warning` |
| 失败 / 不支持 | 红 | `--destructive` |

对应关系写在 `src/lib/task-status.ts`（纯函数，带单测），队列行、详情栏、历史记录共用同一份——
三处各写一遍的话，加一个状态就会漏掉一处。

### 面层的用法（三条，别多）

| 面 | 用在哪 |
| --- | --- |
| `bg-background` | 所有大面板：标题栏、侧栏、工作区、详情栏、对话框底板 |
| `bg-muted` + `/20` `/30` `/50` | 嵌套块与状态：行 hover、行选中、审批/提示卡、胶囊、快捷键块 |
| `bg-popover` | 浮层：下拉、提示气泡、对话框 |

`bg-card` 只留给"卡片式小节"（本项目实际未使用）。
`bg-input/32` 是输入框/下拉触发的底——比面板亮一点点，来源是 `--input` 的 32% 叠加，不是另一个色值。

### 字体

- 正文 `text-sm`（14px 基准下 = 12.25px）／元信息 `text-xs`（10.5px）／**机器产生的数字** `text-[11px]` + `tabular-nums`。
- 按钮与下拉在窄窗口用 14px，`sm:` 以上收到 12.25px——桌面窗口远宽于 640px，所以实际生效的是后者。
- 数字统一 `font-variant-numeric: tabular-nums`：进度、体积、码率、耗时对齐后才能扫读。
- 路径、编码名、日志用 `font-mono`（`JetBrains Mono` → `Consolas` → `ui-monospace`）。
- 小节标题固定配方：`text-[10px] font-medium tracking-wide text-muted-foreground uppercase`。
- 根字号 `--font-size-base: 14px`，也就是 **1rem = 14px、0.25rem = 3.5px**：
  `h-8` = 28px、`gap-2` = 7px、`px-3` = 10.5px。
  **与窗口系统对齐的尺寸必须写死像素**（标题栏 `h-[44px]`、窗口按钮 `w-12`），不能随根字号漂。

### 间距 / 圆角

- 间距按 3.5px 栅格走；实际高频取值：`gap-2`(7) `px-2`(7) `px-3`(10.5) `py-1.5`(5.25) `py-2`(7)。
- 面板内边距 7–10.5px（`p-2` / `p-3`）；对话框 `p-6`（21px）；列表行 `px-3 py-2`。
- 圆角三档：控件 `rounded-lg`(7px)、小控件与行 `rounded-md`(5px)、小标签 `rounded-sm`(5px)；
  对话框 `rounded-2xl`(14px)；进度槽、状态点、胶囊用 `rounded-full`。全站不混用。

### 尺寸阶梯（本项目实际值）

| 元素 | 尺寸 |
| --- | --- |
| 标题栏 | `h-[44px]`，窗口按钮 `w-12` × 3 |
| 侧栏 / 详情栏头部、工作区头部 | `h-12` |
| 侧栏宽 264px；详情栏宽 300px | 窗口默认 1200×800，最小 940×600 |
| 行内图标按钮 | `h-7 w-7` / `h-8 w-8` + `rounded-md` |
| 图标尺寸 | 行内 14px（`h-3.5 w-3.5`）／主按钮与空态 16px（`h-4 w-4`）／chips 12px（`h-3 w-3`） |
| 缩略图 | 96 × 54（16:9，`rounded-md`）；详情栏里是 `aspect-video` 大图 |
| 进度条 | 槽高 1.5（5.25px）、全圆角 |
| 底栏（状态 + 主动作） | `border-t` + `px-3 py-2`，文字 `text-[11px] tabular-nums` |

### 动效

- 缓动统一 `cubic-bezier(0.22, 1, 0.36, 1)`（起步快、收尾稳）；浮层入场用
  `cubic-bezier(0.34, 1.56, 0.64, 1)` + `scale-95 → 1`，150ms。
- 时长只取三档：150ms（hover、浮层）/ 250ms（图标互换）/ 400–500ms（揭示）。
- 只做状态反馈，不做滚动特效、不做装饰动画。
- 从上游搬了四个真的挂在组件上的过渡：
  `t-shake-in`（校验错误抖动）、`t-shimmer`（"正在想…"流光）、
  `t-rise`（空态两行错开 40ms 落地）、`t-icon-swap`（收起/展开的图标互换）。
- `prefers-reduced-motion: reduce` 时全部关闭（`animation: none !important`）。

### 可访问性

- 正文对比度 ≥ 4.5:1（实测：主文字 18.98:1、次要文字 7.62:1、状态色 5.27–9.23:1）。
- 焦点可见：`focus-visible:ring-2 ring-ring ring-offset-1 ring-offset-background`；输入框另走 3px `ring-ring/24` + `border-ring`。
- 状态不只靠颜色：每个状态都是"圆点 + 中文"，`aria-label` 带状态词。
- 纯图标按钮必须有 `aria-label` + `title`。

## 组件规范

**主按钮（每屏仅一个）**：`bg-primary` 反白 + `rounded-lg` + `h-8`，带 `active:scale-[0.97]` 的按下反馈。
全屏只有"开始转换"用它；"添加视频""清空已完成""专业参数"一律走侧栏的列表行形态（透明底、hover 才亮），
避免一屏出现五六个看起来同等重要的入口。

**按钮变体**：`default`（反白）/ `outline`（1px 描边，hover `bg-accent/50`）/ `ghost` / `secondary` /
`destructive` / `destructive-outline` / `link`。尺寸 `xs` `sm` `default` `lg` `xl` + 五个纯图标尺寸。

**输入框与下拉触发**：外层容器承载边框（`rounded-lg border border-input bg-input/32 shadow-xs ring-ring/24`），
内层承载尺寸与文字。触发器和输入框同款——"要填的地方"看起来应该是同一种东西。

**行**（列表、设置项）：`flex items-center gap-2 rounded-md px-2 py-2` + 左侧 `size-4` 图标槽 +
`min-w-0 flex-1 truncate` 主文本 + 右侧元信息；hover `bg-muted/50`、选中 `bg-muted`；
行内动作默认 `opacity-0`，hover / 选中 / 键盘聚焦才出现（`group-hover` / `group-data-[selected]` / `group-focus-within`）——
按钮用 `opacity` 隐身而不是 `hidden`，行宽不会因为出现按钮而跳。

**任务行**：`grid grid-cols-[auto_minmax(0,1fr)_auto_auto]`——缩略图 / 文件名 + 元信息 + 进度 / 状态 / 动作。
状态固定在最右一列，行与行之间按同一列扫读。

**状态标签**：圆点 + 中文，圆点用 `bg-current` 跟文字同色，所以只有一处要维护颜色。

**进度条**：槽 `bg-input`、全圆角；指示器转换中 `bg-info`、完成 `bg-success`。
百分比算不出来时 `value` 传 `null`，走不定态（一段来回滑的色带 + 文字"进行中"），**不假装有个具体百分比**。

**空态**：一句话 + 一个动作，不放插画。`t-rise` 让标题与说明错开 40ms 落地。

**对话框**：`bg-popover` + 1px 描边 + `rounded-2xl`，遮罩 `bg-black/32` + `backdrop-blur-sm`，
入场 150ms 微回弹 + `scale-95 → 1`。头尾固定、只有主体滚动。

**明确不做**：渐变、发光/霓虹、第二个强调色、重阴影、装饰插画、滚动特效、emoji 图标、多个高强调按钮、用色块划分区域。

## 与上游的两处刻意不同

除上面标了 ⚠️ 的颜色调整，还有两处结构性取舍：

1. **不引 framer-motion**。上游的侧栏宽度动画与分组折叠用的是 spring（`stiffness: 400, damping: 30`）。
   本项目只有"展开/收起侧栏"一处动画，用一个 CSS 宽度过渡 + `--ease-smooth-out` 就够，
   不值得为它多一个运行时依赖（ADR-008 依赖最小化）。
2. **底栏只有一条**。上游是"输入框（Composer）+ 状态行（StatsLine）"两条，因为它的主动作是发消息。
   本项目的主动作（开始转换）只作用于队列，单独占一行会空掉半行，所以合成一条：
   左边是机器给的数字，右边是唯一的主按钮。

## 交付自检

- [ ] 只有一种实心主按钮，且每屏只有一个
- [ ] 无渐变、无发光、无装饰插画
- [ ] 层级靠 1px 边框 / 半透明叠加 / 间距 / 字重，没有靠色块堆砌
- [ ] 没有硬编码色值（`#xxxxxx`、`bg-zinc-950`、内联 `style={{ backgroundColor }}`）。
      唯一允许的例外是 `electron/main.ts` 里 `BrowserWindow` 的 `backgroundColor: '#090910'`——
      主进程读不到 CSS 变量，那是 `--background` 的等价值。改令牌时记得一起改。
- [ ] 正文对比度 ≥ 4.5:1；focus 可见；状态不只靠颜色
- [ ] 数字都带 `tabular-nums`
- [ ] 动效 ≤500ms 且只做状态反馈，尊重 `prefers-reduced-motion`
- [ ] 图标来自 lucide（无 emoji）；间距与圆角全局一致
- [ ] 每个可点区域有 pointer + hover + 按下态；禁用态 `opacity-64` + `pointer-events-none`
