## 背景

本次是把已实现的行为回溯写成规格，没有新的技术决策。有决策的部分早已记录在案，这里只做索引。

## 相关决策（详见 docs/decisions.md）

| 编号 | 决策 |
| --- | --- |
| ADR-001 | 桌面框架主选 Electron |
| ADR-002 | ffmpeg 走 CLI 子进程，参数数组传参 |
| ADR-003 | 缩略图用 ffmpeg 抽帧 + 本地缓存 |
| ADR-004 | 设置与历史先用 JSON 文件 |
| ADR-005 | AI 只输出白名单参数 JSON，失败降级到规则 |
| ADR-013 | 样式用原生 CSS 变量，不引 Tailwind |

## 规格与实现、测试的对应

每条规格都能指到实现位置与覆盖它的测试，核对时按这张表走。

| 规格条目 | 实现 | 测试 |
| --- | --- | --- |
| 媒体信息字段与降级 | `src/lib/ffprobe.ts` | `ffprobe.test.ts` |
| 缩略图缓存键与抽帧时间点 | `src/lib/thumbnail-cache.ts` + `electron/ffmpeg/thumbnail.ts` | `thumbnail-cache.test.ts` + `media.integration.test.ts` |
| 导入阶段的可转换性判断 | `src/lib/ffprobe.ts` 的 `assessConvertibility` | `ffprobe.test.ts` + `probe.integration.test.ts` |
| 三档预设与无音轨处理 | `src/lib/ffmpeg-args.ts` | `ffmpeg-args.test.ts` |
| 目标体积反推码率 | `src/lib/ffmpeg-args.ts` 的 `estimateVideoBitrateKbps` | `ffmpeg-args.test.ts` + `media.integration.test.ts` |
| 进度解析与取消 | `src/lib/progress.ts` + `electron/ffmpeg/convert.ts` | `progress.test.ts` + `media.integration.test.ts` |
| 错误翻译 | `src/lib/errors.ts` | `errors.test.ts` |
| 设置记忆 | `src/lib/settings.ts` + `electron/settings.ts` | `settings.test.ts` |

## 已知未覆盖

冒烟清单里未实测的条目（4K 大文件、只读目录、磁盘写满、批量 10 个）已写在 `docs/testing.md`，它们**没有**被写成规格，避免把"未验证"写成"已承诺"。
