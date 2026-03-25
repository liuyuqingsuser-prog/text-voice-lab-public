# Windows 安装包签名方案

适用项目：`Text Voice Lab / 文字转语音学习工具`

提示：本文件是工程实施方案，不替代证书服务商、Microsoft 或律师的正式意见。发布前请结合你的主体资质、目标市场和预算复核。

## 推荐方案

### 方案 A：标准代码签名证书（更容易落地）

适合早期发布、私有分发、小批量交付。

- 购买 OV 或 EV 代码签名证书。
- 将证书导出为 `PFX` 文件，放在受控目录，不要提交到 Git。
- 使用 `signtool.exe` 对最终 `exe` 签名，并附带时间戳。
- 在 `electron-builder` 中通过环境变量注入证书路径和密码。

推荐环境变量：

```powershell
$env:CSC_LINK="C:\secure\codesign\text-voice-lab.pfx"
$env:CSC_KEY_PASSWORD="请替换为你的证书密码"
```

然后执行：

```powershell
npm run dist:win
```

适合点：

- 接入简单。
- 与 `electron-builder` 兼容成熟。
- 适合先做可控分发。

注意点：

- 首次分发仍可能遇到 SmartScreen 信誉积累问题。
- EV 证书通常成本更高，但对初期信誉建立更有帮助。

### 方案 B：Microsoft Trusted Signing（更适合中长期）

适合持续发布、团队化管理、希望减少本地保管私钥风险的场景。

- 在 Azure 中开通 Trusted Signing。
- 按 Microsoft 指引配置证书档案、身份校验和签名账户。
- 在 Windows 构建机上安装 Microsoft Trusted Signing 所需组件。
- 使用 `signtool.exe` 或集成脚本调用 Trusted Signing 完成签名。

适合点：

- 不需要在本地长期保存传统 PFX 私钥。
- 更适合团队协作和 CI/CD。
- 可以逐步替代本地证书文件分发。

注意点：

- 前期配置比 PFX 更复杂。
- 需要 Azure 侧的身份与权限配置。

## 当前项目接入方式

本项目已经做了这些准备：

- `package.json` 中已配置 `dist:win` 打包脚本。
- `build/icons/app.ico` 会作为 Windows 图标参与打包。
- 最终产物默认输出到 `release/`。

## 建议的落地顺序

1. 先使用方案 A 跑通首个带签名版本。
2. 核对安装包、应用主程序和更新包的签名验证结果。
3. 若后续需要频繁发布，再切换或补充方案 B。

## 签名执行建议

- 始终给签名附加时间戳。
- 不要把 `PFX`、密码、Azure 凭据写入仓库。
- 只在受控的 Windows 构建机执行正式签名。
- 发布前用 Windows 机器实际检查文件属性中的数字签名页签。

## 配套脚本

仓库内提供了示例脚本：

- `scripts/signing/sign-win-pfx.ps1`

你可以在填入证书路径和时间戳服务后直接改造成自己的正式脚本。

## 参考资料

- Microsoft SignTool 文档
- Microsoft Trusted Signing 集成文档
- electron-builder Windows code signing 文档
