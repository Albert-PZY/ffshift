# Design System · FFShift

> 这份文件原位于 `design-system/ffshift/MASTER.md`，2026-09-23 目录整理时并入 `docs/`，内容未改。
> 构建界面前先读本文件：颜色、字体、间距、组件规范都在这里，界面实现以它为准。

**Project:** FFShift（桌面视频格式转换器）
**Generated:** 2026-09-22 · **Dials:** 克制 2/10 · 动效 2/10 · 密度 6/10

**来源与调整（如实标注）**

- 风格 / 动效 / 检查清单：来自 ui-ux-pro-max 数据集 **Minimalism & Swiss Style** 条目（单色、essential only、单一强调色、非必要不用阴影、hover 200–250ms、对比度与键盘要求）。
- 暗色底：参考数据集 **Developer Tool / IDE** 暗色条目（深底 + 单色面板 + 绿/红状态色）；经检索验证，数据集的现成配色没有可直接套用的"桌面工具 / 暗色 / 极简"条目，故按风格约束做两处标注调整：① 背景改中性近黑（去掉蓝灰味）；② 交互强调色统一为单色蓝，数据集绿色只保留给"已完成"状态。
- 落地页版式（Hero、滚动叙事）不适用于桌面应用，不采用。

## 设计立场

高级极简 = 更少的颜色、更少的装饰、更清楚的层级。
**颜色不参与分层**：层级用间距、字重、1px 边框表达；颜色只表达状态与唯一主按钮。

## 全局 Token

### 颜色

深色单主题。底色分四层，层级靠它们与 1px 边框表达，不靠阴影堆叠。

| Role | Value | CSS Var | 用途 |
| --- | --- | --- | --- |
| Canvas | `#0B0D10` | `--canvas` | 窗口底 |
| Panel | `#12161B` | `--panel` | 顶栏、左栏、详情栏、列表底 |
| Panel Soft | `#171C22` | `--panel-soft` | 工作区底、输入框底 |
| Panel Raised | `#1B2128` | `--panel-raised` | 悬停、弹层、缩略图占位 |
| Line | `#29313A` | `--line` | 全部 1px 分隔与描边 |
| Ink | `#EDF1F5` | `--ink` | 主文字 |
| Muted | `#8C98A6` | `--muted` | 说明、元信息 |
| Dim | `#596572` | `--dim` | 禁用、次要标签 |
| Accent | `#4D8DFF` | `--blue` | 进度、选中、focus、唯一主按钮 |
| Success | `#35C98A` | `--green` | 已完成 |
| Warning | `#E0A458` | `--amber` | 已取消 |
| Danger | `#EF7272` | `--red` | 失败、不支持、破坏性操作 |

> 这套变量来自 v0.app 生成的界面方案（2026-09-23 采纳，见 ADR-014）：三层底色比原来的
> `bg + surface` 两级更适合三栏布局——面板、工作区底、悬停态各有各的层，不用靠阴影区分。

状态色与状态的对应（八种状态各有归属，颜色只做辅助，文字必须同时表达）：

| 状态 | 颜色 |
| --- | --- |
| 读取中 / 待转换 | `--muted`（中性） |
| 排队中 / 转换中 | `--blue` |
| 已完成 | `--green` |
| 已取消 | `--amber` |
| 失败 / 不支持 | `--red` |

### 字体

- **Inter**（打包本地，不走 CDN）：正文 12px / 行高 1.5；面板标题 14px / 600；区块标签（kicker）10px + 大写字距。
- 数字统一 `font-variant-numeric: tabular-nums`（进度、时长、体积对齐扫读）。
- 进度与参数：等宽 `ui-monospace, "JetBrains Mono", Consolas, monospace`。
- 三栏布局信息密度高，字号比单屏版本收了一档：这是有意的取舍，扫读优先。

### 间距 / 圆角

- 间距 8px 节奏：`4 / 8 / 12 / 16 / 24 / 32`；面板内边距 16–24。
- 圆角：控件 8px、面板与弹层 12px、小标签 6px；全站不混用。

### 动效

- 120–180ms、`ease-out`；只做 hover / 状态变化 / 展开收起的反馈。
- 不做滚动动效、不做装饰动画；`prefers-reduced-motion` 时全部关闭。

### 图标

lucide-react，线性，1.5px 描边；16 / 20px 两档；禁止 emoji 当图标；不给纯文字配装饰图标。

### 可访问性

- 正文对比度 ≥ 4.5:1；focus 可见（2px `--accent` 环 + 2px offset）；状态不只靠颜色（文字/图标同时表达）。

## 组件规范（摘要）

**主按钮（每屏仅一个）**

```css
.primary-button {
  display: inline-flex; align-items: center; gap: 7px;
  min-height: 32px; padding: 0 11px;
  border: 1px solid var(--blue); border-radius: 6px;
  background: var(--blue); color: #fff; font-weight: 600; font-size: 11px;
}
.primary-button:hover:not(:disabled) { filter: brightness(1.08); }
.primary-button:disabled { opacity: .45; cursor: not-allowed; }
```

- 全屏只有"开始转换"用主按钮；"添加视频"、"清空已完成"、"收起详情"一律描边次级，避免两个入口抢注意力。
- **次级按钮 / 图标按钮**：透明底 + 1px `--line`；hover 边框转 `--blue`；纯图标按钮必须有 aria-label。
- **列表行**：行高 100px；缩略图 104×62（圆角 6）；文件名 12px/600，元信息 10px `--muted`；hover 与选中底 `color-mix(--blue 6%, --panel)`；选中另加左侧 2px `--blue` 内阴影（`inset`，不占位）。
- **进度条**：高 4px、圆角 2；轨道 `--line`；转换中填充 `--blue`，完成变 `--green`；时长未知时走不确定态。
- **输入框**：底 `--panel-soft`、1px `--line`、圆角 6；focus 边框 `--blue`。
- **对话框 / 抽屉**：底 `--panel-raised`、圆角 12、遮罩 `rgba(0,0,0,.5)`、阴影克制（`0 16px 30px rgba(0,0,0,.25)`）。
- **空态**：一句话 + 一个动作；不放插画；图片加载失败不留大灰块。

## 明确不做

渐变、发光/霓虹、第二个强调色、重阴影、装饰插画、滚动特效、emoji 图标、多个高强调按钮、用色块划分区域。

## 交付自检

- [ ] 只有一种强调色；主按钮是强调色实心，且每屏只有一个
- [ ] 无渐变、无发光、无装饰插画
- [ ] 层级靠间距/字重/1px 边框，没有靠颜色堆砌
- [ ] 正文对比度 ≥ 4.5:1；focus 可见；状态不只靠颜色
- [ ] 动效 ≤180ms 且只做状态反馈，尊重 reduced-motion
- [ ] 图标来自 Phosphor（无 emoji）；间距与圆角全局一致
- [ ] 所有可点击区域有 pointer + hover + 按下态；禁用态用 not-allowed
