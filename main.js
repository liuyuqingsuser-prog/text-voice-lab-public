const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

let SpeechSDK = null;
const LEGAL_DOCUMENTS = {
  terms: {
    title: "用户协议",
    fileName: "TERMS_OF_USE.md",
  },
  privacy: {
    title: "隐私政策",
    fileName: "PRIVACY_POLICY.md",
  },
};

const AUDIO_FORMATS = {
  mp3: {
    extension: "mp3",
    mimeType: "audio/mpeg",
    sdkKey: "Audio24Khz48KBitRateMonoMp3",
  },
  wav: {
    extension: "wav",
    mimeType: "audio/wav",
    sdkKey: "Riff24Khz16BitMonoPcm",
  },
};

function getSpeechSdk() {
  if (!SpeechSDK) {
    SpeechSDK = require("microsoft-cognitiveservices-speech-sdk");
  }

  return SpeechSDK;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: "#f4ead9",
    title: "文字转语音学习工具",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile(path.join(__dirname, "dist", "renderer", "index.html"));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function assertNonEmpty(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName}不能为空。`);
  }

  return value.trim();
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function sanitizeBaseName(value) {
  const baseName = String(value || "speech-output")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return baseName || "speech-output";
}

function ensureAiLabelInName(fileName) {
  const extension = path.extname(fileName);
  const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
  if (baseName.includes("AI合成")) {
    return fileName;
  }

  return `${baseName}-AI合成${extension}`;
}

function formatRate(rate) {
  const safeRate = clampNumber(rate, -50, 100, 0);
  return `${safeRate >= 0 ? "+" : ""}${safeRate}%`;
}

function formatPitch(pitch) {
  const safePitch = clampNumber(pitch, -50, 50, 0);
  return `${safePitch >= 0 ? "+" : ""}${safePitch}Hz`;
}

function buildSsml({ text, locale, voice, rate, pitch }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => escapeXml(item).replaceAll("\n", '<break time="250ms"/>'));

  const content = paragraphs.length ? paragraphs.join('<break time="550ms"/>') : escapeXml(text);

  return `
<speak version="1.0" xml:lang="${escapeXml(locale)}" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts">
  <voice name="${escapeXml(voice)}">
    <prosody rate="${formatRate(rate)}" pitch="${formatPitch(pitch)}">${content}</prosody>
  </voice>
</speak>`.trim();
}

function buildAiDisclosureText({ voice, locale, format, charCount }) {
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });

  return [
    "AI 合成内容说明",
    "",
    "1. 本音频由“Text Voice Lab / 文字转语音学习工具”基于 AI 文本转语音能力生成，并非真人自然录音。",
    "2. 建议在对外发布、商业传播、平台上传、客户触达、培训播报或其他公开使用场景中保留清晰可见或可听的 AI 合成提示。",
    "3. 生成时间：" + generatedAt,
    "4. 发音人：" + voice,
    "5. 语言区域：" + locale,
    "6. 文件格式：" + format.toUpperCase(),
    "7. 文本字数：" + charCount,
    "8. 使用者应自行确保文本内容、声音使用、传播方式及具体业务场景符合法律法规、平台规则和第三方服务条款。",
  ].join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function markdownToHtml(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  let inList = false;
  const output = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (inList) {
        output.push("</ul>");
        inList = false;
      }
      continue;
    }

    if (line.startsWith("# ")) {
      if (inList) {
        output.push("</ul>");
        inList = false;
      }
      output.push(`<h3>${escapeHtml(line.slice(2))}</h3>`);
      continue;
    }

    if (line.startsWith("## ")) {
      if (inList) {
        output.push("</ul>");
        inList = false;
      }
      output.push(`<h3>${escapeHtml(line.slice(3))}</h3>`);
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        output.push("<ul>");
        inList = true;
      }
      output.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }

    if (inList) {
      output.push("</ul>");
      inList = false;
    }
    output.push(`<p>${escapeHtml(line)}</p>`);
  }

  if (inList) {
    output.push("</ul>");
  }

  return output.join("");
}

async function synthesizeSpeech(payload = {}) {
  const key = assertNonEmpty(payload.key, "Azure Speech Key");
  const region = assertNonEmpty(payload.region, "Azure 区域");
  const voice = assertNonEmpty(payload.voice, "发音人");
  const locale = assertNonEmpty(payload.locale, "语言区域");
  const text = assertNonEmpty(payload.text, "待合成文本");
  const formatKey = payload.format === "wav" ? "wav" : "mp3";
  const rate = clampNumber(payload.rate, -50, 100, 0);
  const pitch = clampNumber(payload.pitch, -50, 50, 0);
  const format = AUDIO_FORMATS[formatKey];
  const sdk = getSpeechSdk();
  const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);

  speechConfig.speechSynthesisVoiceName = voice;
  speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat[format.sdkKey];

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "text-voice-lab-"));
  const outputPath = path.join(tempDir, `speech-output.${format.extension}`);
  const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outputPath);
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);
  const ssml = buildSsml({ text, locale, voice, rate, pitch });

  try {
    const result = await new Promise((resolve, reject) => {
      synthesizer.speakSsmlAsync(
        ssml,
        (synthesisResult) => resolve(synthesisResult),
        (error) => reject(new Error(String(error || "语音合成失败。")))
      );
    });

    if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
      const cancellation = sdk.CancellationDetails.fromResult(result);
      const detail =
        cancellation.errorDetails ||
        cancellation.reason ||
        "Azure Speech 未返回成功结果，请检查密钥、区域、文本长度或发音人配置。";
      throw new Error(detail);
    }

    const audioBuffer = await fs.readFile(outputPath);
    const textSnippet = text.replace(/\s+/g, " ").trim().slice(0, 24);

    return {
      audioBase64: audioBuffer.toString("base64"),
      extension: format.extension,
      mimeType: format.mimeType,
      byteLength: audioBuffer.byteLength,
      voice,
      locale,
      ssml,
      suggestedName: ensureAiLabelInName(
        `${sanitizeBaseName(textSnippet || voice)}.${format.extension}`
      ),
      charCount: text.length,
      aiDisclosureText: buildAiDisclosureText({
        voice,
        locale,
        format: format.extension,
        charCount: text.length,
      }),
    };
  } finally {
    synthesizer.close();
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

ipcMain.handle("synthesize-speech", async (_, payload = {}) => {
  return synthesizeSpeech(payload);
});

ipcMain.handle("save-text-file", async (_, payload = {}) => {
  const suggestedName =
    typeof payload.suggestedName === "string" && payload.suggestedName.trim()
      ? payload.suggestedName.trim()
      : "speech-config.txt";
  const content = typeof payload.content === "string" ? payload.content : "";
  const extension = path.extname(suggestedName).toLowerCase();
  const filters =
    extension === ".ssml"
      ? [{ name: "SSML File", extensions: ["ssml", "xml"] }]
      : [{ name: "Text File", extensions: ["txt"] }];

  const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
    defaultPath: suggestedName,
    filters,
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await fs.writeFile(result.filePath, content, "utf8");
  return { canceled: false, filePath: result.filePath };
});

ipcMain.handle("save-audio-file", async (_, payload = {}) => {
  const base64 = assertNonEmpty(payload.base64, "音频数据");
  const extension = payload.extension === "wav" ? "wav" : "mp3";
  const requestedName =
    typeof payload.suggestedName === "string" && payload.suggestedName.trim()
      ? payload.suggestedName.trim()
      : `speech-output.${extension}`;
  const suggestedName = ensureAiLabelInName(requestedName);
  const filters = [
    {
      name: extension === "wav" ? "Wave Audio" : "MP3 Audio",
      extensions: [extension],
    },
  ];

  const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow(), {
    defaultPath: suggestedName,
    filters,
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await fs.writeFile(result.filePath, Buffer.from(base64, "base64"));
  let disclosurePath = "";

  if (payload.includeAiDisclosure !== false) {
    const disclosureText =
      typeof payload.disclosureText === "string" && payload.disclosureText.trim()
        ? payload.disclosureText.trim()
        : buildAiDisclosureText({
            voice: "unknown",
            locale: "unknown",
            format: extension,
            charCount: 0,
          });
    const parsed = path.parse(result.filePath);
    disclosurePath = path.join(parsed.dir, `${parsed.name}-说明.txt`);
    await fs.writeFile(disclosurePath, disclosureText, "utf8");
  }

  return { canceled: false, filePath: result.filePath, disclosurePath };
});

ipcMain.handle("get-legal-document", async (_, key) => {
  const document = LEGAL_DOCUMENTS[key];
  if (!document) {
    throw new Error("未找到对应的法律文档。");
  }

  const filePath = path.join(__dirname, "legal", document.fileName);
  const content = await fs.readFile(filePath, "utf8");

  return {
    title: document.title,
    content: markdownToHtml(content),
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
