const STORAGE_KEY = "tts-learning-tool-preferences-v1";
const LEGAL_ACCEPTANCE_KEY = "tts-learning-tool-legal-acceptance-v1";
const LEGAL_VERSION = "2026-03-25";
const MAX_LOG_ITEMS = 8;

const VOICES = [
  { id: "zh-CN-XiaoxiaoNeural", locale: "zh-CN", label: "中文 - 晓晓", note: "温和女声" },
  { id: "zh-CN-YunxiNeural", locale: "zh-CN", label: "中文 - 云希", note: "青年男声" },
  { id: "zh-CN-XiaoyiNeural", locale: "zh-CN", label: "中文 - 晓伊", note: "自然女声" },
  { id: "zh-CN-YunjianNeural", locale: "zh-CN", label: "中文 - 云健", note: "沉稳男声" },
  { id: "en-US-AvaNeural", locale: "en-US", label: "English - Ava", note: "warm female" },
  { id: "en-US-BrianNeural", locale: "en-US", label: "English - Brian", note: "calm male" },
  { id: "ja-JP-NanamiNeural", locale: "ja-JP", label: "日本語 - Nanami", note: "soft female" },
  { id: "ja-JP-KeitaNeural", locale: "ja-JP", label: "日本語 - Keita", note: "clear male" },
];

const LEGAL_DOCUMENTS = {
  terms: {
    title: "用户协议",
  },
  privacy: {
    title: "隐私政策",
  },
};

const elements = {
  statusPill: document.getElementById("statusPill"),
  keyInput: document.getElementById("keyInput"),
  regionInput: document.getElementById("regionInput"),
  voiceSelect: document.getElementById("voiceSelect"),
  formatSelect: document.getElementById("formatSelect"),
  rateRange: document.getElementById("rateRange"),
  rateValue: document.getElementById("rateValue"),
  pitchRange: document.getElementById("pitchRange"),
  pitchValue: document.getElementById("pitchValue"),
  textInput: document.getElementById("textInput"),
  charCount: document.getElementById("charCount"),
  summaryVoice: document.getElementById("summaryVoice"),
  summaryRegion: document.getElementById("summaryRegion"),
  summaryFormat: document.getElementById("summaryFormat"),
  summaryChars: document.getElementById("summaryChars"),
  complianceCheckbox: document.getElementById("complianceCheckbox"),
  synthesizeBtn: document.getElementById("synthesizeBtn"),
  resetBtn: document.getElementById("resetBtn"),
  saveAudioBtn: document.getElementById("saveAudioBtn"),
  copySsmlBtn: document.getElementById("copySsmlBtn"),
  saveSsmlBtn: document.getElementById("saveSsmlBtn"),
  audioPlayer: document.getElementById("audioPlayer"),
  audioHint: document.getElementById("audioHint"),
  taskLog: document.getElementById("taskLog"),
  ssmlOutput: document.getElementById("ssmlOutput"),
  disclosureOutput: document.getElementById("disclosureOutput"),
  openTermsBtn: document.getElementById("openTermsBtn"),
  openPrivacyBtn: document.getElementById("openPrivacyBtn"),
  openTermsBtnSecondary: document.getElementById("openTermsBtnSecondary"),
  openPrivacyBtnSecondary: document.getElementById("openPrivacyBtnSecondary"),
  consentModal: document.getElementById("consentModal"),
  consentRightsCheckbox: document.getElementById("consentRightsCheckbox"),
  consentPrivacyCheckbox: document.getElementById("consentPrivacyCheckbox"),
  consentAiCheckbox: document.getElementById("consentAiCheckbox"),
  confirmConsentBtn: document.getElementById("confirmConsentBtn"),
  viewTermsFromConsentBtn: document.getElementById("viewTermsFromConsentBtn"),
  viewPrivacyFromConsentBtn: document.getElementById("viewPrivacyFromConsentBtn"),
  legalModal: document.getElementById("legalModal"),
  legalTitle: document.getElementById("legalTitle"),
  legalContent: document.getElementById("legalContent"),
  closeLegalModalBtn: document.getElementById("closeLegalModalBtn"),
  recordStateBadge: document.getElementById("recordStateBadge"),
  recordStatus: document.getElementById("recordStatus"),
  recordVersion: document.getElementById("recordVersion"),
  recordAcceptedAt: document.getElementById("recordAcceptedAt"),
  consentRecordOutput: document.getElementById("consentRecordOutput"),
  viewConsentRecordBtn: document.getElementById("viewConsentRecordBtn"),
  exportConsentRecordBtn: document.getElementById("exportConsentRecordBtn"),
  resetConsentRecordBtn: document.getElementById("resetConsentRecordBtn"),
};

const state = {
  isBusy: false,
  previewUrl: "",
  logs: [],
  lastResult: null,
  legalAccepted: false,
  legalAcceptanceRecord: null,
};

function setStatus(text, variant = "idle") {
  elements.statusPill.textContent = text;
  elements.statusPill.dataset.variant = variant;
}

function formatSignedPercent(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}%`;
}

function formatSignedHz(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}Hz`;
}

function formatFileSize(byteLength) {
  const bytes = Number(byteLength) || 0;
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function getVoiceById(id) {
  return VOICES.find((voice) => voice.id === id) || VOICES[0];
}

function getRegionValue() {
  return elements.regionInput.value.trim().toLowerCase();
}

function getTextValue() {
  return elements.textInput.value.trim();
}

function hasConsentChecks() {
  return (
    elements.consentRightsCheckbox.checked &&
    elements.consentPrivacyCheckbox.checked &&
    elements.consentAiCheckbox.checked
  );
}

function syncConsentButton() {
  elements.confirmConsentBtn.disabled = !hasConsentChecks();
}

function syncLegalGate() {
  if (state.legalAccepted) {
    elements.consentModal.classList.remove("is-visible");
    elements.consentModal.setAttribute("aria-hidden", "true");
    return;
  }

  elements.consentModal.classList.add("is-visible");
  elements.consentModal.setAttribute("aria-hidden", "false");
}

function setBusy(value) {
  state.isBusy = Boolean(value);
  const hasResult = Boolean(state.lastResult);
  const locked = state.isBusy || !state.legalAccepted;

  elements.keyInput.disabled = locked;
  elements.regionInput.disabled = locked;
  elements.voiceSelect.disabled = locked;
  elements.formatSelect.disabled = locked;
  elements.rateRange.disabled = locked;
  elements.pitchRange.disabled = locked;
  elements.textInput.disabled = locked;
  elements.complianceCheckbox.disabled = locked;
  elements.synthesizeBtn.disabled = locked;
  elements.resetBtn.disabled = locked;
  elements.saveAudioBtn.disabled = !hasResult || locked;
  elements.copySsmlBtn.disabled = !hasResult || locked;
  elements.saveSsmlBtn.disabled = !hasResult || locked;
}

function savePreferences() {
  const preferences = {
    region: getRegionValue(),
    voice: elements.voiceSelect.value,
    format: elements.formatSelect.value,
    rate: elements.rateRange.value,
    pitch: elements.pitchRange.value,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

function restorePreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    const saved = JSON.parse(raw);
    if (typeof saved.region === "string") {
      elements.regionInput.value = saved.region;
    }
    if (VOICES.some((voice) => voice.id === saved.voice)) {
      elements.voiceSelect.value = saved.voice;
    }
    if (saved.format === "mp3" || saved.format === "wav") {
      elements.formatSelect.value = saved.format;
    }
    if (saved.rate !== undefined) {
      elements.rateRange.value = String(saved.rate);
    }
    if (saved.pitch !== undefined) {
      elements.pitchRange.value = String(saved.pitch);
    }
  } catch (error) {
    console.warn("读取本地偏好失败", error);
  }
}

function restoreLegalAcceptance() {
  try {
    const raw = localStorage.getItem(LEGAL_ACCEPTANCE_KEY);
    if (!raw) {
      state.legalAcceptanceRecord = null;
      state.legalAccepted = false;
      return;
    }

    const saved = JSON.parse(raw);
    state.legalAcceptanceRecord = saved;
    state.legalAccepted = saved.version === LEGAL_VERSION && saved.accepted === true;
  } catch (error) {
    console.warn("读取合规确认失败", error);
    state.legalAcceptanceRecord = null;
    state.legalAccepted = false;
  }
}

function persistLegalAcceptance() {
  const record = {
    accepted: true,
    version: LEGAL_VERSION,
    acceptedAt: new Date().toISOString(),
  };
  localStorage.setItem(
    LEGAL_ACCEPTANCE_KEY,
    JSON.stringify(record)
  );
  state.legalAcceptanceRecord = record;
}

function clearLegalAcceptance() {
  localStorage.removeItem(LEGAL_ACCEPTANCE_KEY);
  state.legalAcceptanceRecord = null;
  state.legalAccepted = false;
}

function formatAcceptedAt(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("zh-CN", { hour12: false });
}

function buildConsentRecordText() {
  const record = state.legalAcceptanceRecord;
  if (!record) {
    return [
      "当前设备还没有保存合规确认记录。",
      "",
      "说明：",
      "1. 首次启动确认通过后，会把版本号和确认时间写入本地 localStorage。",
      "2. 点击“重置并重新确认”后，会删除这条本地记录并重新弹出确认弹窗。",
    ].join("\n");
  }

  return [
    "当前合规确认记录",
    "",
    `状态：${record.accepted ? "已确认" : "未确认"}`,
    `版本：${record.version || "--"}`,
    `确认时间：${formatAcceptedAt(record.acceptedAt)}`,
    `是否与当前版本匹配：${state.legalAccepted ? "是" : "否"}`,
    "",
    "存储位置：浏览器 localStorage",
    `存储键名：${LEGAL_ACCEPTANCE_KEY}`,
  ].join("\n");
}

function renderConsentRecord() {
  const record = state.legalAcceptanceRecord;
  const accepted = Boolean(record?.accepted) && state.legalAccepted;

  elements.recordStateBadge.textContent = accepted ? "已确认" : "尚未确认";
  elements.recordStatus.textContent = accepted ? "已完成" : "未完成";
  elements.recordVersion.textContent = record?.version || "--";
  elements.recordAcceptedAt.textContent = formatAcceptedAt(record?.acceptedAt);
  elements.consentRecordOutput.value = buildConsentRecordText();
}

function populateVoices() {
  const localeLabels = {
    "zh-CN": "中文",
    "en-US": "English",
    "ja-JP": "日本語",
  };
  const groups = new Map();

  for (const voice of VOICES) {
    const group = groups.get(voice.locale) || [];
    group.push(voice);
    groups.set(voice.locale, group);
  }

  elements.voiceSelect.innerHTML = Array.from(groups.entries())
    .map(([locale, voices]) => {
      const label = localeLabels[locale] || locale;
      const options = voices
        .map(
          (voice) =>
            `<option value="${voice.id}">${voice.label} · ${voice.note}</option>`
        )
        .join("");

      return `<optgroup label="${label}">${options}</optgroup>`;
    })
    .join("");
}

function updateSliderLabels() {
  elements.rateValue.textContent = formatSignedPercent(elements.rateRange.value);
  elements.pitchValue.textContent = formatSignedHz(elements.pitchRange.value);
}

function updateSummary() {
  const voice = getVoiceById(elements.voiceSelect.value);
  const textLength = getTextValue().length;

  elements.charCount.textContent = `${textLength} / 5000`;
  elements.summaryVoice.textContent = `${voice.label} · ${voice.note}`;
  elements.summaryRegion.textContent = getRegionValue() || "未填写";
  elements.summaryFormat.textContent = elements.formatSelect.value.toUpperCase();
  elements.summaryChars.textContent = String(textLength);
}

function renderLog() {
  if (!state.logs.length) {
    elements.taskLog.innerHTML =
      '<p class="empty-progress">准备就绪，等待你输入文本并发起语音合成。</p>';
    return;
  }

  elements.taskLog.innerHTML = state.logs
    .map(
      (item) => `
        <article class="log-item" data-variant="${item.variant}">
          <div class="log-item-head">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="log-time">${escapeHtml(item.time)}</span>
          </div>
          <p class="log-text">${escapeHtml(item.message)}</p>
        </article>
      `
    )
    .join("");
}

function addLog(title, message, variant = "info") {
  const now = new Date();
  state.logs.unshift({
    title,
    message,
    variant,
    time: now.toLocaleTimeString("zh-CN", { hour12: false }),
  });
  state.logs = state.logs.slice(0, MAX_LOG_ITEMS);
  renderLog();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function clearPreviewUrl() {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = "";
  }
}

function clearResult() {
  clearPreviewUrl();
  state.lastResult = null;
  elements.audioPlayer.removeAttribute("src");
  elements.audioPlayer.load();
  elements.audioHint.textContent =
    "合成完成后，这里会显示试听播放器、文件信息与生成配置。";
  elements.ssmlOutput.value = "";
  elements.disclosureOutput.value = "";
  setBusy(state.isBusy);
}

function base64ToUint8Array(base64) {
  const binary = window.atob(base64);
  const length = binary.length;
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function renderResult(result) {
  clearPreviewUrl();
  state.lastResult = result;

  const bytes = base64ToUint8Array(result.audioBase64);
  const blob = new Blob([bytes], { type: result.mimeType });
  state.previewUrl = URL.createObjectURL(blob);

  elements.audioPlayer.src = state.previewUrl;
  elements.audioHint.textContent = `${getVoiceById(result.voice).label} · ${result.extension.toUpperCase()} · ${formatFileSize(result.byteLength)} · ${result.charCount} 字`;
  elements.ssmlOutput.value = result.ssml;
  elements.disclosureOutput.value = result.aiDisclosureText || "";
  setBusy(false);
}

async function openLegalModal(type) {
  const document = LEGAL_DOCUMENTS[type];
  if (!document) {
    return;
  }

  elements.legalTitle.textContent = document.title;
  elements.legalContent.innerHTML = "<p>正在载入文档...</p>";
  elements.legalModal.classList.add("is-visible");
  elements.legalModal.setAttribute("aria-hidden", "false");

  try {
    const loaded = await window.desktopBridge.getLegalDocument(type);
    elements.legalTitle.textContent = loaded.title || document.title;
    elements.legalContent.innerHTML = loaded.content || "<p>文档内容为空。</p>";
  } catch (error) {
    console.error(error);
    elements.legalContent.innerHTML =
      "<p>文档读取失败，请检查本地模板文件是否已随应用一起打包。</p>";
    addLog("文档读取失败", error?.message || "无法读取本地法务模板。", "error");
  }
}

function closeLegalModal() {
  elements.legalModal.classList.remove("is-visible");
  elements.legalModal.setAttribute("aria-hidden", "true");
}

function handleViewConsentRecord() {
  restoreLegalAcceptance();
  renderConsentRecord();
  addLog("已查看记录", "已刷新并展示当前设备上的合规确认记录。");
}

async function handleExportConsentRecord() {
  restoreLegalAcceptance();
  renderConsentRecord();

  const result = await window.desktopBridge.saveTextFile({
    suggestedName: `consent-record-${LEGAL_VERSION}.txt`,
    content: buildConsentRecordText(),
  });

  if (!result.canceled) {
    addLog("记录已导出", `当前合规确认记录已保存到 ${result.filePath}。`);
  }
}

function handleResetConsentRecord() {
  clearLegalAcceptance();
  elements.consentRightsCheckbox.checked = false;
  elements.consentPrivacyCheckbox.checked = false;
  elements.consentAiCheckbox.checked = false;
  elements.complianceCheckbox.checked = false;
  syncConsentButton();
  renderConsentRecord();
  syncLegalGate();
  setBusy(false);
  setStatus("等待确认", "idle");
  addLog("已重置记录", "本地合规确认记录已删除，已重新弹出首次启动确认。");
}

function validateForm() {
  if (!state.legalAccepted) {
    throw new Error("请先完成首次启动合规确认。");
  }

  if (!elements.keyInput.value.trim()) {
    throw new Error("请先填写你自己的 Azure Speech Key。");
  }

  if (!getRegionValue()) {
    throw new Error("请先填写 Azure 区域，例如 eastasia。");
  }

  if (!getTextValue()) {
    throw new Error("请输入要合成为语音的文本内容。");
  }

  if (!elements.complianceCheckbox.checked) {
    throw new Error("请先勾选合法使用确认，再开始合成。");
  }
}

async function handleSynthesize() {
  try {
    validateForm();
  } catch (error) {
    setStatus("校验失败", "error");
    addLog("输入未通过", error.message, "error");
    return;
  }

  const voice = getVoiceById(elements.voiceSelect.value);
  const payload = {
    key: elements.keyInput.value.trim(),
    region: getRegionValue(),
    voice: voice.id,
    locale: voice.locale,
    format: elements.formatSelect.value,
    rate: Number(elements.rateRange.value),
    pitch: Number(elements.pitchRange.value),
    text: getTextValue(),
  };

  savePreferences();
  setBusy(true);
  setStatus("正在合成", "working");
  addLog("已提交任务", `正在使用 ${voice.label} 生成 ${elements.formatSelect.value.toUpperCase()} 音频。`);

  try {
    const result = await window.desktopBridge.synthesizeSpeech(payload);
    renderResult(result);
    setStatus("合成完成", "ready");
    addLog("合成完成", "已生成音频，并同步生成建议披露的 AI 标识说明。");
  } catch (error) {
    console.error(error);
    clearResult();
    setBusy(false);
    setStatus("合成失败", "error");
    addLog(
      "合成失败",
      error?.message || "Azure Speech 返回异常，请检查 Key、区域、网络或配额设置。",
      "error"
    );
  }
}

function handleReset() {
  elements.keyInput.value = "";
  elements.textInput.value = "";
  elements.complianceCheckbox.checked = false;
  clearResult();
  updateSummary();
  updateSliderLabels();
  setStatus("等待输入", "idle");
  addLog("已清空", "文本和本次生成结果已清空，已保留非敏感偏好设置。");
}

async function handleSaveAudio() {
  if (!state.lastResult) {
    return;
  }

  const result = await window.desktopBridge.saveAudioFile({
    base64: state.lastResult.audioBase64,
    extension: state.lastResult.extension,
    suggestedName: state.lastResult.suggestedName,
    disclosureText: state.lastResult.aiDisclosureText,
    includeAiDisclosure: true,
  });

  if (!result.canceled) {
    const suffix = result.disclosurePath ? `，并生成说明文件 ${result.disclosurePath}` : "";
    addLog("音频已导出", `已保存到 ${result.filePath}${suffix}。`);
  }
}

async function handleSaveSsml() {
  if (!state.lastResult) {
    return;
  }

  const result = await window.desktopBridge.saveTextFile({
    suggestedName: state.lastResult.suggestedName.replace(/\.(mp3|wav)$/i, ".ssml"),
    content: state.lastResult.ssml,
  });

  if (!result.canceled) {
    addLog("SSML 已保存", `已保存到 ${result.filePath}。`);
  }
}

function handleCopySsml() {
  if (!state.lastResult) {
    return;
  }

  window.desktopBridge.copyText(state.lastResult.ssml);
  addLog("SSML 已复制", "本次提交给 Azure Speech 的 SSML 已复制到剪贴板。");
}

function bindEvents() {
  elements.voiceSelect.addEventListener("change", () => {
    updateSummary();
    savePreferences();
  });

  elements.formatSelect.addEventListener("change", () => {
    updateSummary();
    savePreferences();
  });

  elements.regionInput.addEventListener("input", () => {
    updateSummary();
    savePreferences();
  });

  elements.textInput.addEventListener("input", updateSummary);

  elements.rateRange.addEventListener("input", () => {
    updateSliderLabels();
    savePreferences();
  });

  elements.pitchRange.addEventListener("input", () => {
    updateSliderLabels();
    savePreferences();
  });

  elements.synthesizeBtn.addEventListener("click", handleSynthesize);
  elements.resetBtn.addEventListener("click", handleReset);
  elements.saveAudioBtn.addEventListener("click", handleSaveAudio);
  elements.saveSsmlBtn.addEventListener("click", handleSaveSsml);
  elements.copySsmlBtn.addEventListener("click", handleCopySsml);

  elements.openTermsBtn.addEventListener("click", () => openLegalModal("terms"));
  elements.openPrivacyBtn.addEventListener("click", () => openLegalModal("privacy"));
  elements.openTermsBtnSecondary.addEventListener("click", () => openLegalModal("terms"));
  elements.openPrivacyBtnSecondary.addEventListener("click", () => openLegalModal("privacy"));
  elements.viewTermsFromConsentBtn.addEventListener("click", () => openLegalModal("terms"));
  elements.viewPrivacyFromConsentBtn.addEventListener("click", () => openLegalModal("privacy"));
  elements.closeLegalModalBtn.addEventListener("click", closeLegalModal);
  elements.viewConsentRecordBtn.addEventListener("click", handleViewConsentRecord);
  elements.exportConsentRecordBtn.addEventListener("click", handleExportConsentRecord);
  elements.resetConsentRecordBtn.addEventListener("click", handleResetConsentRecord);
  elements.legalModal.addEventListener("click", (event) => {
    if (event.target === elements.legalModal) {
      closeLegalModal();
    }
  });

  for (const checkbox of [
    elements.consentRightsCheckbox,
    elements.consentPrivacyCheckbox,
    elements.consentAiCheckbox,
  ]) {
    checkbox.addEventListener("change", syncConsentButton);
  }

  elements.confirmConsentBtn.addEventListener("click", () => {
    if (!hasConsentChecks()) {
      return;
    }

    state.legalAccepted = true;
    persistLegalAcceptance();
    renderConsentRecord();
    syncLegalGate();
    setBusy(false);
    addLog("已完成首次确认", "已记录本机合规确认，可继续使用文本转语音功能。");
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLegalModal();
    }
  });
}

function init() {
  populateVoices();
  restorePreferences();
  restoreLegalAcceptance();
  updateSliderLabels();
  updateSummary();
  bindEvents();
  clearResult();
  renderConsentRecord();
  syncConsentButton();
  syncLegalGate();
  setBusy(false);
  setStatus("等待输入", "idle");
  addLog("准备就绪", "本工具不会调用参考网站接口，请使用你自己的 Azure Speech 资源。");

  if (!state.legalAccepted) {
    addLog("等待首次确认", "请先阅读并确认用户协议、隐私政策和 AI 披露要求。");
  }
}

window.addEventListener("beforeunload", () => {
  clearPreviewUrl();
});

init();
