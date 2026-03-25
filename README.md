# Text Voice Lab

原创界面的桌面端文字转语音工具，参考在线 TTS 工具的常见工作流，但不调用参考网站接口，不冒用参考网站品牌信息。

## 功能

- 输入文本后调用官方 Azure Speech SDK 合成语音
- 支持多语言发音人、语速和音调调节
- 支持导出 `MP3` 与 `WAV`
- 主界面显式标注“第三方学习工具”
- 显示 SSML 预览，方便排查和二次集成
- 默认不保存用户输入的 Azure Speech Key

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

1. 在 Azure 创建你自己的 Speech 资源。
2. 填写 `Speech Key` 与 `Region`。
3. 输入待合成文本并勾选合法使用确认。
4. 点击“开始合成”，试听后导出音频。

## 风险控制思路

- 不内置任何第三方账号、Cookie、共享密钥或参考网站接口。
- 不使用参考网站名称、Logo、备案信息或“官方”措辞。
- 通过界面文案持续提示“第三方学习工具”与非官方属性。
- 要求用户自行确认文本版权、声音使用权和用途合法性。
- 商业使用前，应自行复核 Azure 平台条款及当地法律要求。

## 配套文档

- Windows 签名方案：`docs/windows-signing-guide.md`
- 用户协议模板：`legal/TERMS_OF_USE.md`
- 隐私政策模板：`legal/PRIVACY_POLICY.md`

## 官方参考文档

- Azure Speech 文本转语音：
  https://learn.microsoft.com/azure/ai-services/speech-service/text-to-speech
- SSML 发音人文档：
  https://learn.microsoft.com/azure/ai-services/speech-service/speech-synthesis-markup-voice
- 语音 AI 披露建议：
  https://learn.microsoft.com/azure/ai-services/responsible-ai/speech-service/disclosure-design-guidance
