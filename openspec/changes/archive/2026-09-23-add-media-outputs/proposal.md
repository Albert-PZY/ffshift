## Why

当前只能"视频转视频"和"从视频里转出音频"这两类还算完整，但缺了三块真实需求：把视频当音源提取声音（现在只能整体转换）、输出 GIF 动图、以及带透明通道的素材（游戏录像、带 alpha 的 mov）转 yuv 编码后透明区变黑。

前两块是"格式转换器"的基本盘，第三块是对照 `flyingmouse-format`（6157 star 的同类工具）时发现的坑：它的源码里专门有一层探测与合成来避免透明区变黑。

## What Changes

- 音频输出：mp3 / m4a / opus / flac / wav，丢弃视频轨；源没有音轨时明确报错
- GIF 输出：调色板两遍法（palettegen + paletteuse）
- 透明通道处理：探测到 alpha 像素格式时，先叠一层底色再编码
- 时长兜底：探针没给时长时，从 ffmpeg 的输出里补

## 影响

- 不改已有格式的行为（MP4 / MKV / MOV / WebM 的参数与升级前一致）
- `src/lib/ffprobe.ts` 增加像素格式字段；`ConvertOptions` 增加源视频信息
