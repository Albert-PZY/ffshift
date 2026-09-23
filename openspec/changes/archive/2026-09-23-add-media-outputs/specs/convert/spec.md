## ADDED Requirements

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
