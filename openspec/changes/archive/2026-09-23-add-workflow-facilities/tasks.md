## 1. 数据与契约

- [x] `ConvertOutcome` 的 done 分支增加 `outputSizeBytes`
- [x] 设置升到 v2：增加 history；v1 可平滑升级
- [x] 新增 IPC：`pick-folder`、`scan-folder`、`notify`
- [x] 输出格式白名单从容器表生成，避免再次不同步

## 2. 功能

- [x] 输出目录可选
- [x] 文件夹导入（只扫一层）
- [x] 队列跑完的系统通知
- [x] 原始日志展开与复制
- [x] 目标体积直接输入
- [x] 转换历史（成功与失败都记）
- [x] 体积对比
- [x] 连续失败 2 次停止 + 手动重试

## 3. 验证

- [x] 单测：输出路径 7 条、设置与历史 16 条、格式回归
- [x] 集成测试：失败时 `error.raw` 非空
- [x] 端到端：转换成功且带回 `outputSizeBytes`
- [ ] 历史记录的写入链路没有端到端实测（e2e 走主进程，不经过渲染进程的 store）——已在 `docs/testing.md` 如实标注
