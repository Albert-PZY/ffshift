# 打包、签名与安装

## 打包

```bash
npm run package            # NSIS 安装包 + 便携版，输出到 release/
npm run package:portable   # 只出便携版
```

打包流程串了三步：`prepare-ffmpeg`（把系统 ffmpeg 复制进 resources）→ `make-icon`
（从 icon.png 生成多尺寸 ICO）→ `electron-vite build` → `electron-builder --win`。

产物（release/）：

| 文件 | 用途 |
| --- | --- |
| `FFShift-x.y.z-setup.exe` | NSIS 安装包：桌面 / 开始菜单快捷方式、可自选目录、卸载器 |
| `FFShift-x.y.z-portable.exe` | 免安装：双击直接用，不写注册表 |
| `latest.yml` | electron-updater 的更新清单（本次未接自动更新，先占位） |
| `.blockmap` | 增量更新用的差分包索引 |

ffmpeg / ffprobe 随包分发（extraResources），用户下载后不用再装任何东西。

## 签名（可选）

没有代码签名证书也能打安装包，Windows 会弹 SmartScreen 提示。
要消除提示需要一张代码签名证书（个人开发者一年几百美元）。

```bash
# 配置环境变量
$env:FFSHIFT_SIGN_PFX  = "path\to\cert.pfx"
$env:FFSHIFT_SIGN_PASS = "证书密码"

npm run package       # 先打包（electron-builder 会自动调 signtool 签 exe）
npm run verify-sign   # 验签 release/ 里所有 exe
```

如果 electron-builder 没有自动签（比如证书是自签的），单独跑：

```bash
npm run sign
```

`signtool.exe` 从 Windows SDK 的标准安装位置自动找；
也可以用 `FFSHIFT_SIGNTOOL` 指定路径。

## 安装

安装包走 NSIS：默认装到 `%LocalAppData%\Programs\FFShift`，可以自选目录，
可选"仅为我"或"为所有用户"（需要管理员权限）。卸载走系统"应用和功能"。

便携版是一个独立的 exe，放在任何目录都能跑，设置存在 exe 同目录的 `settings.json`。

## 版本与发布

1. 改 `package.json` 的 `version`
2. `npm run package`
3. （可选）`npm run sign`
4. 在 GitHub Releases 上建 tag 与 Release，上传 `release/` 里的两个 exe
