## 1. 数据层

- [x] `FontSize` 档位类型与像素表（`src/lib/font-scale.ts`）
- [x] 进设置文件（版本 6），存档位名不存像素值
- [x] `minWindowSize`：按档位算窗口下限

## 2. 应用与接线

- [x] 建窗口之前读字号，塞进渲染进程 argv
- [x] `main.tsx` 在建 root 之前应用
- [x] 存设置时同步更新窗口下限，必要时撑开

## 3. 让布局真的跟着缩放

- [x] 两档小字号改成 rem 令牌（`text-label` / `text-metric`）
- [x] 左栏、详情栏宽度与缩略图改成 rem
- [x] 标题栏与窗口按钮保持固定像素（要和系统一致）

## 4. 界面

- [x] 设置页「外观」加字号分段切换 + 当前档位说明

## 5. 验证

- [x] `npm run typecheck`
- [x] `npm run test:unit`
- [x] `npm run build`
- [x] `npm run test:e2e`
- [x] 四档字号各截一张图；最小窗口 + 最大字号那一档确认不再挤成一团

