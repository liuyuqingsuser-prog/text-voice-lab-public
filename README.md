# Text Voice Lab Free

免费离线版桌面端文字转语音工具。保留原有的桌面工作流和界面结构，但不再依赖 Azure Speech，不需要填写 Key，直接使用操作系统已安装的本地语音进行合成。

## 功能

- 输入文本后使用本机离线语音合成音频
- 支持读取系统已安装发音人
- 支持语速调节
- 支持导出 `WAV`
- 主界面持续展示合规提示与 AI 标识建议
- 默认不把文本发送到外部云端语音服务

## 启动

```bash
npm install
npm start
```

## 打包

```bash
npm run dist:win
```

打包产物默认输出到 `release/` 目录。

图标资源会在打包前由 `npm run generate:icons` 自动生成。

## 使用说明

1. 确保当前系统已经安装可用的语音包。
2. 选择本地发音人。
3. 输入待合成文本并勾选合法使用确认。
4. 点击“开始合成”，试听后导出 `WAV` 音频。

## 说明

- 这是纯免费离线版，不需要 Azure Speech Key。
- 可用发音人与语言数量取决于当前操作系统。
- 当前版本统一导出 `WAV`，以保证跨平台本地合成更稳定。

## 配套文档

- Windows 签名方案：`docs/windows-signing-guide.md`
- 用户协议模板：`legal/TERMS_OF_USE.md`
- 隐私政策模板：`legal/PRIVACY_POLICY.md`
