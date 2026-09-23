# settings Specification

## Purpose
TBD - created by archiving change 2026-09-23-add-settings-page. Update Purpose after archive.

## Requirements

### Requirement: 设置页

系统 SHALL 提供独立的设置界面，入口 SHALL 在主界面顶栏的右上角，并 SHALL 能返回转换界面。设置界面 SHALL 按分类组织内容：输出、参数预设、外观、关于。设置页与转换界面 SHALL 不同屏显示。

#### Scenario: 打开设置

- **WHEN** 用户在转换界面点击顶栏的设置按钮
- **THEN** 界面切换到设置页，转换栏、队列与详情栏都不再显示

#### Scenario: 返回

- **WHEN** 用户点击设置页的返回按钮
- **THEN** 回到转换界面，之前的队列与选中状态不变

#### Scenario: 切换分类

- **WHEN** 用户点击左侧的某个分类
- **THEN** 右侧内容换成该分类，且当前分类有选中态

### Requirement: 主题偏好的入口在设置里

系统 SHALL 提供亮色与暗色两套主题，默认亮色。切换入口 SHALL 只在设置的「外观」分类里，主界面顶栏 SHALL NOT 提供主题切换。选择 SHALL 被记住，且应用启动的第一帧 SHALL 就是所选主题。

#### Scenario: 切换主题

- **WHEN** 用户在设置里选择暗色
- **THEN** 界面立即切换，且主界面顶栏没有主题按钮

#### Scenario: 记住选择

- **WHEN** 用户选了暗色后重启应用
- **THEN** 首帧就是暗色，不会先闪一下亮色

### Requirement: 引擎信息在设置里

系统 SHALL 在设置的「关于」分类里显示应用版本、ffmpeg 版本与硬件加速状态，并 SHALL 提供重新检测硬件加速的入口。主界面顶栏 SHALL 只显示硬件的简短状态与一个说明性圆点。

#### Scenario: 重新检测硬件加速

- **WHEN** 用户点击「重新检测」
- **THEN** 硬件加速状态按最新结果刷新

#### Scenario: 顶栏保持简短

- **WHEN** 用户停留在转换界面
- **THEN** 顶栏只出现圆点加一句短标签（如「硬件加速：amf」或「CPU 编码」），不出现完整版本串

### Requirement: 输出位置在设置里改

系统 SHALL 把输出目录的修改入口放在设置的「输出」分类里。主界面 SHALL 只以只读方式显示当前输出位置。

#### Scenario: 改完之后回主界面

- **WHEN** 用户在设置里选了输出目录并返回
- **THEN** 主界面底栏显示新的输出位置
