# convert Specification

## Purpose

回答"怎么把视频转小、转清楚"，以及出错时用户能不能自己解决。用户只需要在三个档位里选一个，不用碰命令行参数；转换过程要看得见（百分比、剩余时间、速度）、随时能停，失败了要看到人话而不是 ffmpeg 的英文原话。

对应的实现是 `src/lib/ffmpeg-args.ts`、`src/lib/progress.ts`、`src/lib/errors.ts` 与 `electron/ffmpeg/convert.ts`；决策背景见 `docs/decisions.md` 的 ADR-002 与 ADR-005。

## Requirements

### Requirement: 三档预设

系统 SHALL 提供三个档位：更清晰（存档、再剪辑）、均衡（日常）、更小（发微信、手机）。每档 SHALL 使用固定的一组编码参数，且不暴露命令行参数给用户。

#### Scenario: 均衡档转换

- **WHEN** 用户选择均衡档并开始转换
- **THEN** 使用 H.264 CRF 21、preset medium、AAC 128k，并把 moov 前置（`+faststart`）

#### Scenario: 更小档转换

- **WHEN** 用户选择更小档
- **THEN** 使用 H.265 CRF 26、音频 96k

### Requirement: 无音轨文件不带音频参数

系统 SHALL 在源文件没有音轨时省略全部音频参数；带上音频参数会让 ffmpeg 直接报错。

#### Scenario: 转换无声视频

- **WHEN** 转换一个没有音轨的视频
- **THEN** 命令行里不出现 `-c:a` 与 `-b:a`，转换正常完成

### Requirement: 硬件加速自动选择

系统 SHALL 用"试编码 1 秒"的方式确认硬件编码器真的可用（列表里有不等于能用），可用时自动使用，不可用时回退到 CPU 软编，并把当前用的是哪一类告诉用户。

#### Scenario: 存在可用硬件编码器

- **WHEN** 探测到 nvenc / qsv / amf 中任一可用
- **THEN** 转换使用对应编码器，界面顶栏显示"硬件加速可用"

#### Scenario: 没有可用硬件编码器

- **WHEN** 所有候选编码器试编码都失败
- **THEN** 使用 libx264 软编，界面显示"使用 CPU 编码"

### Requirement: 目标体积

系统 SHALL 支持按目标体积转换：由目标体积与时长反推视频码率，同时扣掉音频码率；结果过低时 SHALL 保底，避免产出不可看的视频。缺少时长时 SHALL 明确报错，不猜测。

#### Scenario: 指定 50 MiB 与已知时长

- **WHEN** 用户指定目标体积且文件时长已知
- **THEN** 使用码率模式（`-b:v`），不使用 CRF

#### Scenario: 缺少时长却指定了体积

- **WHEN** 目标体积存在但时长未知
- **THEN** 拒绝该次转换并说明需要时长，不产生错误的码率

### Requirement: 进度与取消

系统 SHALL 从 ffmpeg 的结构化进度输出解析已处理时长、速度与写出体积，节流后展示；取消 SHALL 结束进程并删除半成品文件。

#### Scenario: 转换中展示进度

- **WHEN** 转换进行中
- **THEN** 显示百分比、剩余时间与速度；百分比单调不减，最终到达 100%

#### Scenario: 取消转换

- **WHEN** 用户在转换中点取消
- **THEN** 任务标记为"已取消"，输出目录里不留半成品

#### Scenario: 时长未知的文件

- **WHEN** 时长未知但要转换
- **THEN** 只显示"已处理时长与速度"，不显示百分比

### Requirement: 输出不覆盖源文件

系统 SHALL 为转换结果生成与源文件不同的路径（同目录加后缀），任何情况下都不覆盖源文件。

#### Scenario: 默认输出路径

- **WHEN** 用户没有指定输出路径
- **THEN** 输出为"源文件名 + .ffshift"后缀，与原文件同目录

### Requirement: 错误翻译成人话

系统 SHALL 把 ffmpeg 的英文报错映射成用户能自己处理的说明，无法识别时 SHALL 保留原始输出末尾若干行供排查。

#### Scenario: 磁盘空间不足

- **WHEN** 目标盘空间不足导致写失败
- **THEN** 提示"目标磁盘空间不足"并说明可以清理或换盘

#### Scenario: 输出位置打不开

- **WHEN** 输出目录不存在或不可写
- **THEN** 提示指向输出位置，不得误报成"找不到输入文件"

#### Scenario: 被取消的任务

- **WHEN** 任务是用户主动取消的
- **THEN** 说明这是取消而非失败

### Requirement: 设置记忆

系统 SHALL 记住用户的档位与输出目录，并在下次启动时恢复；设置文件损坏或字段非法时 SHALL 回到默认值而不是启动失败。

#### Scenario: 修改档位后重启

- **WHEN** 用户把档位改成更小档后重启应用
- **THEN** 界面仍显示更小档

#### Scenario: 设置文件被改坏

- **WHEN** 设置文件内容不是合法 JSON 或字段非法
- **THEN** 应用正常启动并使用默认设置

### Requirement: 选择输出格式

系统 SHALL 允许用户选择输出格式：MP4、MKV、MOV、WebM，或保持原格式。界面 SHALL 直接显示当前选择，且选择 SHALL 被记住到下次启动。

#### Scenario: 转成 MP4

- **WHEN** 用户选择 MP4 并转换一个 MKV 文件
- **THEN** 产物是 MP4 容器，视频为 H.264、音频为 AAC

#### Scenario: 保持原格式

- **WHEN** 用户选择保持原格式转换一个 MKV 文件
- **THEN** 产物仍是 MKV，扩展名与原文件一致

#### Scenario: 记住选择

- **WHEN** 用户选择 WebM 后重启应用
- **THEN** 输出格式仍显示 WebM

### Requirement: 编码跟随容器

系统 SHALL 按目标容器选择编码器，不得产生容器与编码互斥的组合。目标为 WebM 时 SHALL 使用 VP9 与 Opus，并 SHALL NOT 使用硬件编码器。

#### Scenario: 源是 WebM 且保持 WebM

- **WHEN** 转换一个 WebM 文件并保持 WebM 输出
- **THEN** 使用 VP9 与 Opus，转换成功，不再出现"容器不收这个编码"

#### Scenario: WebM 源转成 MP4

- **WHEN** 把 WebM 转成 MP4
- **THEN** 使用 H.264 与 AAC

#### Scenario: 硬件加速与 WebM 冲突

- **WHEN** 探测到可用硬件编码器，但目标是 WebM
- **THEN** 回退到软编的 VP9，不因硬件加速而失败

### Requirement: 输出扩展名决定容器

系统 SHALL 以输出文件扩展名作为选择容器与编码器的最终依据——ffmpeg 按文件名选封装器，参数必须与之一致。输出扩展名无法识别时，才回落到格式参数或源文件扩展名。

#### Scenario: 文件名与格式参数不一致

- **WHEN** 格式选择是"保持原格式"，但输出文件名以 .webm 结尾
- **THEN** 使用 WebM 兼容的 VP9 与 Opus，而不是按源文件格式选编码

### Requirement: 失败不留半成品

系统 SHALL 在转换失败时删除未能完成的输出文件，与取消时的处理一致。

#### Scenario: 转换中途失败

- **WHEN** 因容器或编码不兼容导致转换失败
- **THEN** 输出路径上不残留无效文件

### Requirement: 音频输出

系统 SHALL 支持把视频转成音频格式：MP3、M4A、Opus、FLAC、WAV。产物 SHALL 只包含音频流。源文件没有音轨时，系统 SHALL 明确拒绝并说明原因，SHALL NOT 产出空文件。

#### Scenario: 提取音轨

- **WHEN** 用户选择 MP3 并转换一个带音轨的视频
- **THEN** 产物是 MP3，不含视频流

#### Scenario: 无损格式

- **WHEN** 用户选择 FLAC 或 WAV
- **THEN** 使用无损编码，不附加有损码率参数

#### Scenario: 源文件没有音轨

- **WHEN** 源文件无音轨而用户选择了音频格式
- **THEN** 任务失败并说明"源文件没有音频轨道，无法转换成音频格式"

### Requirement: GIF 输出

系统 SHALL 支持输出 GIF，并 SHALL 使用调色板两遍法（先 palettegen 再 paletteuse）而不是直接编码。产物 SHALL 循环播放，SHALL NOT 包含音频。

#### Scenario: 转成 GIF

- **WHEN** 用户选择 GIF 并转换一段视频
- **THEN** 产物是循环播放的 GIF，画面渐变处没有明显色带

### Requirement: 透明通道的源先合成底色

源视频的像素格式带透明通道时（rgba、argb、yuva* 等），系统 SHALL 在转成不保留透明通道的编码前合成底色，SHALL NOT 让透明区变成黑色。

#### Scenario: 半透明素材转 MP4

- **WHEN** 转换一个带 alpha 通道的素材到 MP4
- **THEN** 产物中原本透明的区域显示为底色（默认白色）

#### Scenario: 不带透明通道的源

- **WHEN** 源视频没有透明通道
- **THEN** 不插入额外的合成步骤，避免多解码一路

### Requirement: 时长兜底

源时长未知时，系统 SHALL 尝试从 ffmpeg 自己的输出里解析时长，用于计算进度百分比。

#### Scenario: 探针没给出时长

- **WHEN** ffprobe 未返回时长，但 ffmpeg 输出里含 `Duration:` 信息
- **THEN** 进度按该时长计算百分比，而不是只显示"进行中"

#### Scenario: 多路输入

- **WHEN** 命令里有多路输入（例如 alpha 合成加进来的底色）
- **THEN** 只采用第一处时长，不把附加输入当成源

### Requirement: 输出目录可选

系统 SHALL 允许用户指定输出目录。未指定或指定为空时，产物 SHALL 落在源文件旁边。指定目录时，输出文件名 SHALL 仍不与源文件重名。

#### Scenario: 指定目录

- **WHEN** 用户选择了一个输出目录并开始转换
- **THEN** 产物落在该目录下，文件名沿用「原名 + .ffshift + 目标扩展名」

#### Scenario: 恢复默认

- **WHEN** 用户清除输出目录设置
- **THEN** 产物回到源文件旁边

#### Scenario: 目录结尾的分隔符

- **WHEN** 用户选中的目录路径以分隔符结尾
- **THEN** 拼接结果不出现双斜杠

### Requirement: 文件夹导入

系统 SHALL 支持选择一个文件夹并导入其中的视频文件。扫描 SHALL 只覆盖该层目录。支持的扩展名 SHALL 与文件选择框一致。

#### Scenario: 导入文件夹

- **WHEN** 用户选择一个含视频的文件夹
- **THEN** 其中的视频按文件名顺序加入队列，已存在的路径不重复添加

#### Scenario: 空文件夹

- **WHEN** 文件夹里没有可识别的视频
- **THEN** 队列不变，不报错

### Requirement: 完成通知

系统 SHALL 在队列全部执行完毕时发出一次系统通知，通知内容 SHALL 包含完成与失败的数量。系统不支持通知时 SHALL 静默跳过，不影响流程。

#### Scenario: 队列跑完

- **WHEN** 最后一个任务结束且没有任务在排队
- **THEN** 发出一次系统通知，例如「转换结束 · 完成 3 个，失败 1 个」

#### Scenario: 仍有任务在排队

- **WHEN** 一个任务结束但队列里还有任务
- **THEN** 不发通知

### Requirement: 失败的原始日志可查看

转换失败时，系统 SHALL 保留 ffmpeg 的原始输出。界面 SHALL 提供展开查看与复制的能力。

#### Scenario: 查看原始日志

- **WHEN** 任务失败且用户展开「查看原始日志」
- **THEN** 显示 ffmpeg 输出的末尾若干行

#### Scenario: 复制日志

- **WHEN** 用户点「复制日志」
- **THEN** 原始输出进入剪贴板，按钮短暂显示「已复制」

### Requirement: 目标体积可直接输入

系统 SHALL 允许用户直接指定目标体积（MiB）。输入 SHALL 收敛到 1–10000 的整数；留空表示不限体积。该设置 SHALL NOT 持久化（它是针对当前批次的临时设置）。

#### Scenario: 输入体积

- **WHEN** 用户填入 50
- **THEN** 转换按目标体积模式计算码率

#### Scenario: 留空

- **WHEN** 用户清空输入框
- **THEN** 回到按档位的恒定质量模式

### Requirement: 转换历史

系统 SHALL 记录每次转换的结果（成功与失败都记）。记录 SHALL 包含文件名、源路径、输出路径、源与产物体积、格式、档位、结束时间、耗时与结果。记录数 SHALL 有上限，超出时丢弃最旧的。单条记录损坏 SHALL NOT 影响其余记录，也 SHALL NOT 影响设置文件整体。

#### Scenario: 转换成功后

- **WHEN** 一个任务完成
- **THEN** 追加一条记录，并写入设置文件

#### Scenario: 转换失败后

- **WHEN** 一个任务失败
- **THEN** 同样追加一条记录，结果标记为失败

#### Scenario: 历史记录损坏

- **WHEN** 设置文件里某条历史缺少关键字段
- **THEN** 只丢弃这一条，其余记录与设置照常加载

#### Scenario: 清空历史

- **WHEN** 用户点「清空历史」
- **THEN** 记录清空并落盘

### Requirement: 结果体积对比

转换成功后，系统 SHALL 显示源文件与产物的体积对比，含增减百分比。产物大小读不到时 SHALL 显示占位符，SHALL NOT 显示 NaN。

#### Scenario: 体积变小

- **WHEN** 产物小于源文件
- **THEN** 显示形如「4.5 MiB → 1.2 MiB（-73%）」

#### Scenario: 产物大小读不到

- **WHEN** 转换成功但产物已被移走
- **THEN** 该字段显示占位符

### Requirement: 连续失败停止

同一个任务连续失败达到 2 次后，系统 SHALL NOT 在用户点「开始转换」时自动重新入队；界面 SHALL 说明原因并提供手动重试入口。

#### Scenario: 第二次失败

- **WHEN** 同一任务连续失败 2 次
- **THEN** 详情栏说明「已连续失败 2 次」，行内出现「重试」按钮

#### Scenario: 手动重试

- **WHEN** 用户点「重试」
- **THEN** 失败计数与原始日志被清空，任务回到待转换
