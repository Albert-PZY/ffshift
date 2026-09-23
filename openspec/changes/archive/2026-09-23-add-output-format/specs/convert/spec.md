## ADDED Requirements

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
