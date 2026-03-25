const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

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

const DEFAULT_VOICE_ID = "__default__";
const OFFLINE_AUDIO_FORMAT = {
  extension: "wav",
  mimeType: "audio/wav",
};
const ENGINE_LABELS = {
  darwin: "macOS 系统离线语音",
  win32: "Windows 系统离线语音",
  linux: "Linux 系统离线语音",
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: "#f4ead9",
    title: "Text Voice Lab Free",
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

function failWithDetail(prefix, error) {
  const stderr = String(error?.stderr || "").trim();
  const stdout = String(error?.stdout || "").trim();
  const detail = stderr || stdout || error?.message || "未知错误。";
  throw new Error(`${prefix}${detail}`);
}

async function runCommand(file, args, options = {}) {
  try {
    return await execFileAsync(file, args, {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      ...options,
    });
  } catch (error) {
    failWithDetail(`${file} 执行失败：`, error);
  }
}

async function runPowerShell(script) {
  return runCommand("powershell", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script,
  ]);
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

function getEngineLabel(platform = process.platform) {
  return ENGINE_LABELS[platform] || "系统离线语音";
}

function normalizeLocale(value) {
  const normalized = String(value || "").trim().replaceAll("_", "-");
  return normalized || "system";
}

function defaultVoiceEntry() {
  return {
    id: DEFAULT_VOICE_ID,
    label: "系统默认语音",
    locale: "system",
    note: getEngineLabel(),
  };
}

function dedupeVoices(voices) {
  const seen = new Set();
  const result = [];

  for (const voice of voices) {
    if (!voice?.id || seen.has(voice.id)) {
      continue;
    }
    seen.add(voice.id);
    result.push(voice);
  }

  return result;
}

function parseMacVoiceLine(line) {
  const [prefix, sample = ""] = String(line).split(/\s+#\s*/, 2);
  const match = prefix.trim().match(/^(.*?)\s+([A-Za-z]{2}_[A-Za-z]{2}(?:_[^ ]+)?)$/u);
  if (!match) {
    return null;
  }

  return {
    id: match[1].trim(),
    label: match[1].trim(),
    locale: normalizeLocale(match[2]),
    note: sample.trim() || "macOS 内置语音",
  };
}

function normalizeJsonArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return [value];
}

function toUtf8Json(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return [];
  }

  return normalizeJsonArray(JSON.parse(trimmed));
}

async function listMacVoices() {
  const { stdout } = await runCommand("say", ["-v", "?"]);
  return stdout
    .split(/\r?\n/)
    .map(parseMacVoiceLine)
    .filter(Boolean);
}

async function listWindowsVoices() {
  const script = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $voices = $synth.GetInstalledVoices() | ForEach-Object {
    $info = $_.VoiceInfo
    [PSCustomObject]@{
      id = $info.Name
      label = $info.Name
      locale = if ($info.Culture) { $info.Culture.Name } else { 'system' }
      note = if ($info.Gender) { $info.Gender.ToString() } else { 'Windows voice' }
    }
  }
  $voices | ConvertTo-Json -Compress
} finally {
  $synth.Dispose()
}`;

  const { stdout } = await runPowerShell(script);
  return toUtf8Json(stdout).map((voice) => ({
    id: String(voice.id || "").trim(),
    label: String(voice.label || voice.id || "").trim(),
    locale: normalizeLocale(voice.locale),
    note: String(voice.note || "Windows 内置语音").trim(),
  }));
}

function parseEspeakLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("Pty") || trimmed.startsWith("Age")) {
    return null;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length < 5) {
    return null;
  }

  return {
    id: parts[3],
    label: parts[3],
    locale: normalizeLocale(parts[1]),
    note: parts.slice(4).join(" "),
  };
}

async function listLinuxVoices() {
  const { stdout } = await runCommand("espeak", ["--voices"]);
  return stdout
    .split(/\r?\n/)
    .map(parseEspeakLine)
    .filter(Boolean);
}

async function getOfflineVoices() {
  let voices = [];

  try {
    if (process.platform === "darwin") {
      voices = await listMacVoices();
    } else if (process.platform === "win32") {
      voices = await listWindowsVoices();
    } else if (process.platform === "linux") {
      voices = await listLinuxVoices();
    }
  } catch (_error) {
    voices = [];
  }

  return dedupeVoices([defaultVoiceEntry(), ...voices]);
}

function buildAiDisclosureText({ voice, locale, format, charCount }) {
  const generatedAt = new Date().toLocaleString("zh-CN", { hour12: false });

  return [
    "AI 合成内容说明",
    "",
    "1. 本音频由“Text Voice Lab Free / 免费离线版”基于本机离线语音能力生成，并非真人自然录音。",
    "2. 本版本默认不连接云端合成服务，不需要 Azure Speech Key。",
    "3. 建议在对外发布、商业传播、平台上传、客户触达、培训播报或其他公开使用场景中保留清晰可见或可听的 AI 合成提示。",
    "4. 生成时间：" + generatedAt,
    "5. 发音人：" + voice,
    "6. 语言区域：" + locale,
    "7. 文件格式：" + format.toUpperCase(),
    "8. 文本字数：" + charCount,
    "9. 使用者应自行确保文本内容、声音使用、传播方式及具体业务场景符合法律法规、平台规则和第三方服务条款。",
  ].join("\n");
}

function buildConfigPreview({ voiceLabel, locale, rate, pitch, charCount }) {
  return [
    "离线合成配置",
    "",
    `合成引擎：${getEngineLabel()}`,
    `发音人：${voiceLabel}`,
    `语言区域：${locale}`,
    `导出格式：${OFFLINE_AUDIO_FORMAT.extension.toUpperCase()}`,
    `语速：${formatRate(rate)}`,
    `音调：系统默认（当前离线版不支持独立调音，已忽略 ${formatPitch(pitch)}）`,
    `文本字数：${charCount}`,
    "",
    "说明：",
    "1. 本版本为免费离线版，使用系统自带语音。",
    "2. 可选发音人数量取决于当前操作系统已安装的语音包。",
    "3. 输出统一为 WAV，便于在离线模式下稳定导出。",
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

async function synthesizeOnMac({ textPath, outputPath, voiceId, rate }) {
  const aiffPath = path.join(path.dirname(outputPath), "speech-output.aiff");
  const wordsPerMinute = clampNumber(Math.round(175 * (1 + rate / 100)), 90, 360, 175);
  const args = ["-r", String(wordsPerMinute), "-o", aiffPath, "-f", textPath];

  if (voiceId && voiceId !== DEFAULT_VOICE_ID) {
    args.unshift(voiceId);
    args.unshift("-v");
  }

  await runCommand("say", args);
  await runCommand("afconvert", ["-f", "WAVE", "-d", "LEI16@24000", aiffPath, outputPath]);
}

function escapePowerShellString(value) {
  return String(value || "").replaceAll("'", "''");
}

async function synthesizeOnWindows({ textPath, outputPath, voiceId, rate }) {
  const windowsRate = clampNumber(Math.round(rate / 10), -10, 10, 0);
  const safeVoice = escapePowerShellString(
    voiceId && voiceId !== DEFAULT_VOICE_ID ? voiceId : ""
  );
  const safeInput = escapePowerShellString(textPath);
  const safeOutput = escapePowerShellString(outputPath);
  const script = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  if ('${safeVoice}') {
    $synth.SelectVoice('${safeVoice}')
  }
  $synth.Rate = ${windowsRate}
  $synth.SetOutputToWaveFile('${safeOutput}')
  $text = [System.IO.File]::ReadAllText('${safeInput}')
  $synth.Speak($text)
} finally {
  $synth.Dispose()
}`;

  await runPowerShell(script);
}

async function synthesizeOnLinux({ textPath, outputPath, voiceId, rate }) {
  const speed = clampNumber(Math.round(175 * (1 + rate / 100)), 90, 360, 175);
  const args = ["-w", outputPath, "-s", String(speed)];

  if (voiceId && voiceId !== DEFAULT_VOICE_ID) {
    args.push("-v", voiceId);
  }

  args.push("-f", textPath);
  await runCommand("espeak", args);
}

async function synthesizeOfflineAudio({ text, voiceId, rate }) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "text-voice-lab-free-"));
  const textPath = path.join(tempDir, "speech-input.txt");
  const outputPath = path.join(tempDir, `speech-output.${OFFLINE_AUDIO_FORMAT.extension}`);

  await fs.writeFile(textPath, text, "utf8");

  try {
    if (process.platform === "darwin") {
      await synthesizeOnMac({ textPath, outputPath, voiceId, rate });
    } else if (process.platform === "win32") {
      await synthesizeOnWindows({ textPath, outputPath, voiceId, rate });
    } else if (process.platform === "linux") {
      await synthesizeOnLinux({ textPath, outputPath, voiceId, rate });
    } else {
      throw new Error("当前系统暂不支持离线语音合成。");
    }

    const audioBuffer = await fs.readFile(outputPath);
    return { audioBuffer, tempDir };
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function synthesizeSpeech(payload = {}) {
  const voiceId =
    typeof payload.voice === "string" && payload.voice.trim()
      ? payload.voice.trim()
      : DEFAULT_VOICE_ID;
  const voiceLabel =
    typeof payload.voiceLabel === "string" && payload.voiceLabel.trim()
      ? payload.voiceLabel.trim()
      : "系统默认语音";
  const locale =
    typeof payload.locale === "string" && payload.locale.trim()
      ? payload.locale.trim()
      : "system";
  const text = assertNonEmpty(payload.text, "待合成文本");
  const rate = clampNumber(payload.rate, -50, 100, 0);
  const pitch = clampNumber(payload.pitch, -50, 50, 0);

  const { audioBuffer, tempDir } = await synthesizeOfflineAudio({
    text,
    voiceId,
    rate,
  });

  try {
    const textSnippet = text.replace(/\s+/g, " ").trim().slice(0, 24);

    return {
      audioBase64: audioBuffer.toString("base64"),
      extension: OFFLINE_AUDIO_FORMAT.extension,
      mimeType: OFFLINE_AUDIO_FORMAT.mimeType,
      byteLength: audioBuffer.byteLength,
      voice: voiceId,
      voiceLabel,
      locale,
      charCount: text.length,
      configPreview: buildConfigPreview({
        voiceLabel,
        locale,
        rate,
        pitch,
        charCount: text.length,
      }),
      suggestedName: ensureAiLabelInName(
        `${sanitizeBaseName(textSnippet || voiceLabel)}.${OFFLINE_AUDIO_FORMAT.extension}`
      ),
      aiDisclosureText: buildAiDisclosureText({
        voice: voiceLabel,
        locale,
        format: OFFLINE_AUDIO_FORMAT.extension,
        charCount: text.length,
      }),
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

ipcMain.handle("list-offline-voices", async () => {
  const voices = await getOfflineVoices();
  return {
    voices,
    engineLabel: getEngineLabel(),
    supportsPitch: false,
    formats: [OFFLINE_AUDIO_FORMAT.extension],
  };
});

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
    extension === ".txt"
      ? [{ name: "Text File", extensions: ["txt"] }]
      : [{ name: "Text File", extensions: ["txt", "md"] }];

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
  const extension = OFFLINE_AUDIO_FORMAT.extension;
  const requestedName =
    typeof payload.suggestedName === "string" && payload.suggestedName.trim()
      ? payload.suggestedName.trim()
      : `speech-output.${extension}`;
  const suggestedName = ensureAiLabelInName(requestedName);
  const filters = [
    {
      name: "Wave Audio",
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
            voice: "系统默认语音",
            locale: "system",
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
