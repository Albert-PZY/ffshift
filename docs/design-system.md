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

| Role | Value | CSS Var | 用途 |
| --- | --- | --- | --- |
| Background | `#0B0C0E` | `--bg` | 窗口底色 |
| Surface | `#14161A` | `--surface` | 卡片、面板、列表底 |
| Surface Hover | `#1A1D22` | `--surface-hover` | 行/控件悬停 |
| Border | `rgba(255,255,255,.08)` | `--border` | 默认分隔（1px） |
| Border Strong | `rgba(255,255,255,.16)` | `--border-strong` | 输入框、次级按钮 |
| Text | `#F4F5F7` | `--text` | 主文字 |
| Text Secondary | `#9AA3AE` | `--text-secondary` | 说明、元信息 |
| Text Disabled | `#565E6B` | `--text-disabled` | 禁用 |
| Accent | `#3B82F6` | `--accent` | 进度条、选中、链接、focus ring |
| Accent Hover | `#2563EB` | `--accent-hover` | 强调色悬停/按压 |
| On Accent | `#FFFFFF` | `--on-accent` | 强调底上的文字 |
| Success | `#22C55E` | `--success` | 已完成 |
| Warning | `#F59E0B` | `--warning` | 需要注意（少用） |
| Danger | `#EF4444` | `--danger` | 失败、破坏性操作 |
| Inverse Button | `#F5F6F7` / `#0B0C0E` | `--btn-inverse` | 主按钮：反白底 + 深色字 |

### 字体

- **Inter**（打包本地，不走 CDN）：正文 13–14px / 行高 1.5；标题 15–16px / 600；字重只用 400 / 500 / 600。
- 数字统一 `font-variant-numeric: tabular-nums`（进度、时长、体积对齐扫读）。
- 日志与参数：等宽 `ui-monospace, "JetBrains Mono", Consolas, monospace`。

### 间距 / 圆角

- 间距 8px 节奏：`4 / 8 / 12 / 16 / 24 / 32`；面板内边距 16–24。
- 圆角：控件 8px、面板与弹层 12px、小标签 6px；全站不混用。

### 动效

- 120–180ms、`ease-out`；只做 hover / 状态变化 / 展开收起的反馈。
- 不做滚动动效、不做装饰动画；`prefers-reduced-motion` 时全部关闭。

### 图标

- Phosphor，线性，1.5px 描边；16 / 20px 两档；禁止 emoji 当图标；不给纯文字配装饰图标。

### 可访问性

- 正文对比度 ≥ 4.5:1；focus 可见（2px `--accent` 环 + 2px offset）；状态不只靠颜色（文字/图标同时表达）。

## 组件规范（摘要）

**主按钮（每屏仅一个）**

```css
.btn-primary { background:#F5F6F7; color:#0B0C0E; border-radius:8px; padding:8px 16px;
  font-weight:500; transition:background 150ms ease-out; cursor:pointer; }
.btn-primary:hover { background:#FFFFFF; }
.btn-primary:disabled { background:#1A1D22; color:#565E6B; cursor:not-allowed; }
```

- **次级按钮 / 图标按钮**：透明底 + 1px `--border-strong`；hover 用 `--surface-hover`；纯图标按钮必须有 aria-label。
- **列表行**：高 64px；缩略图 96×54（圆角 6）；文件名 14px/500，元信息 12px `--text-secondary`；hover 底 `--surface-hover`；选中：1px `--accent` 边框 + 左侧 2px `--accent` 指示条。
- **进度条**：高 4px、圆角 2；轨道 `rgba(255,255,255,.08)`；转换中填充 `--accent`，完成变 `--success`。
- **输入框**：底 `--surface`、1px `--border-strong`、圆角 8；focus 边框 `--accent`。
- **对话框 / 抽屉**：底 `--surface`、圆角 12、遮罩 `rgba(0,0,0,.5)`、阴影克制（`0 8px 24px rgba(0,0,0,.4)`）。
- **空态**：一句话 + 一个动作；不放插画；图片加载失败不留大灰块。

## 明确不做

渐变、发光/霓虹、第二个强调色、重阴影、装饰插画、滚动特效、emoji 图标、多个高强调按钮、用色块划分区域。

## 交付自检

- [ ] 只有一种强调色；主按钮反白，且每屏只有一个
- [ ] 无渐变、无发光、无装饰插画
- [ ] 层级靠间距/字重/1px 边框，没有靠颜色堆砌
- [ ] 正文对比度 ≥ 4.5:1；focus 可见；状态不只靠颜色
- [ ] 动效 ≤180ms 且只做状态反馈，尊重 reduced-motion
- [ ] 图标来自 Phosphor（无 emoji）；间距与圆角全局一致
- [ ] 所有可点击区域有 pointer + hover + 按下态；禁用态用 not-allowed
