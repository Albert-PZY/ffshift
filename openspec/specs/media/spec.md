# media Specification

## Purpose

回答"这个文件是什么、能不能转、长什么样"。用户导入文件后要立刻拿到判断依据（时长、分辨率、体积、一眼能认出的缩略图），而不可转换的文件要在导入阶段就被拦下，不让他点了开始才失败。

对应的实现是 `src/lib/ffprobe.ts`、`src/lib/thumbnail-cache.ts` 与 `electron/ffmpeg/` 下的探测、抽帧代码；决策背景见 `docs/decisions.md` 的 ADR-003。

## Requirements

### Requirement: 导入后读取媒体信息

系统 SHALL 在文件导入后读取并显示时长、分辨率与文件体积。字段缺失或不合法时，界面 SHALL 显示降级文案，不得出现 NaN、undefined 或错误的百分比。

#### Scenario: 正常视频

- **WHEN** 用户导入一个可解析的视频文件
- **THEN** 该行显示时长、分辨率与体积

#### Scenario: 时长缺失

- **WHEN** 文件的时长字段缺失或为 `N/A`
- **THEN** 界面显示"时长未知"，进度区不显示百分比

#### Scenario: 字段类型异常

- **WHEN** 分辨率字段不是数字
- **THEN** 该字段按不可用处理（不显示），其余字段正常

### Requirement: 生成并复用缩略图

系统 SHALL 为导入的视频生成缩略图并缓存。缓存键 SHALL 包含文件路径、修改时间与大小；三者一致时 SHALL 直接复用缓存，不调用 ffmpeg。

#### Scenario: 首次导入

- **WHEN** 首次导入某个视频
- **THEN** 抽取一帧、缩放到 480 宽并写入缓存目录

#### Scenario: 再次导入未修改的同一文件

- **WHEN** 同一文件（路径、修改时间、大小都不变）再次导入
- **THEN** 直接使用缓存文件，不启动 ffmpeg

#### Scenario: 文件被替换

- **WHEN** 原路径上的文件被换成另一个文件
- **THEN** 缓存键变化，重新抽帧，不显示旧缩略图

#### Scenario: 抽帧失败

- **WHEN** 抽帧失败（文件损坏、时长异常等）
- **THEN** 该行不显示图片；不重试、不刷错误提示

### Requirement: 导入阶段判断文件能不能转

系统 SHALL 在没有视频轨、或容器不属于常见视频容器时拒绝该文件，并给出人话原因，避免让用户点了开始才失败。

#### Scenario: 纯音频文件

- **WHEN** 导入一个只有音频轨的文件
- **THEN** 标记为不支持，原因写明"没有视频轨"

#### Scenario: 垃圾数据被 ffprobe 猜成冷门格式

- **WHEN** 文件是垃圾数据，ffprobe 未报错但把它识别成 cdg、adp 这类冷门容器
- **THEN** 判定为不可转换并说明容器不常见，不显示猜出来的分辨率

#### Scenario: 冷门但正常的专业容器

- **WHEN** 导入 mxf 等专业容器，且带视频轨
- **THEN** 判定为可以转换
