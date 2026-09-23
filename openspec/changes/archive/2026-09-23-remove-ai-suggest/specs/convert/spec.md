## MODIFIED Requirements

### Requirement: 目标体积可直接输入

系统 SHALL 允许用户直接指定目标体积（MiB）。输入 SHALL 收敛到 1–10000 的整数；留空表示不限体积。该设置 SHALL NOT 持久化（它是针对当前批次的临时设置）。

#### Scenario: 输入体积

- **WHEN** 用户填入 50
- **THEN** 转换按目标体积模式计算码率

#### Scenario: 留空

- **WHEN** 用户清空输入框
- **THEN** 回到按档位的恒定质量模式
