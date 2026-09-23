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
