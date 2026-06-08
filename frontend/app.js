const STORAGE_KEY = "trpg-world-status:last-snapshot";
const WAITING_TEXT = "等待生成";

const sourceText = document.querySelector("#sourceText");
const fileInput = document.querySelector("#fileInput");
const maxChars = document.querySelector("#maxChars");
const runButton = document.querySelector("#runButton");
const copyButton = document.querySelector("#copyButton");
const output = document.querySelector("#output");
const resolvedOutput = document.querySelector("#resolvedOutput");
const meta = document.querySelector("#meta");
const health = document.querySelector("#health");
const saveStatus = document.querySelector("#saveStatus");
const storageNotice = document.querySelector("#storageNotice");
const saveButton = document.querySelector("#saveButton");
const loadButton = document.querySelector("#loadButton");
const clearButton = document.querySelector("#clearButton");
const downloadJsonButton = document.querySelector("#downloadJsonButton");
const downloadTxtButton = document.querySelector("#downloadTxtButton");

let currentWorldState = null;
let currentModel = "";
let currentUsage = null;
let lastSavedAt = "";
let noticeTimer = null;

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("health check failed");
    health.textContent = "服务可用";
    health.className = "status ok";
  } catch {
    health.textContent = "服务异常";
    health.className = "status error";
  }
}

function setBusy(isBusy) {
  runButton.disabled = isBusy;
  runButton.textContent = isBusy ? "生成中..." : "生成本体化世界状态";
}

function hasGeneratedContent() {
  return Boolean(sourceText.value.trim() || resolvedOutput.textContent.trim() || currentWorldState);
}

function readStoredSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function updateStorageControls() {
  const storedSnapshot = readStoredSnapshot();
  saveButton.disabled = !hasGeneratedContent();
  loadButton.disabled = !storedSnapshot;
  clearButton.disabled = !storedSnapshot && !hasGeneratedContent();
  downloadJsonButton.disabled = !currentWorldState;
  downloadTxtButton.disabled = !resolvedOutput.textContent.trim() || resolvedOutput.textContent === WAITING_TEXT;

  if (lastSavedAt) {
    saveStatus.textContent = `上次保存：${formatDate(lastSavedAt)}`;
  } else if (storedSnapshot) {
    saveStatus.textContent = "当前浏览器已有保存快照。";
  } else {
    saveStatus.textContent = "尚无已保存快照。";
  }
}

function showStorageNotice(message, type = "info", timeout = 4500) {
  storageNotice.textContent = message;
  storageNotice.className = `notice ${type}`;
  storageNotice.hidden = false;

  if (noticeTimer) {
    window.clearTimeout(noticeTimer);
  }

  noticeTimer = window.setTimeout(() => {
    storageNotice.hidden = true;
    noticeTimer = null;
  }, timeout);
}

function buildSnapshot(savedAt = new Date().toISOString()) {
  return {
    sourceText: sourceText.value,
    resolvedText: resolvedOutput.textContent,
    worldState: currentWorldState,
    maxChars: Number(maxChars.value || 1200),
    model: currentModel,
    usage: currentUsage,
    savedAt,
  };
}

function saveSnapshot() {
  const savedAt = new Date().toISOString();
  const snapshot = buildSnapshot(savedAt);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    lastSavedAt = savedAt;
    updateStorageControls();
    showStorageNotice("Saved locally. You can reopen this same browser page and use Load Last.", "success");
  } catch {
    showStorageNotice(
      "Save failed: browser storage unavailable. This can happen in private browsing, restricted browser settings, or when site data is full.",
      "error",
      7000
    );
  }
}

function loadSnapshot() {
  const snapshot = readStoredSnapshot();
  if (!snapshot) return;

  sourceText.value = snapshot.sourceText || "";
  resolvedOutput.textContent = snapshot.resolvedText || "";
  currentWorldState = snapshot.worldState || null;
  output.textContent = currentWorldState ? JSON.stringify(currentWorldState, null, 2) : "{}";
  maxChars.value = snapshot.maxChars || 1200;
  currentModel = snapshot.model || "";
  currentUsage = snapshot.usage || null;
  lastSavedAt = snapshot.savedAt || "";
  meta.textContent = currentModel ? `已载入快照 · ${currentModel}` : "已载入快照";
  copyButton.disabled = !currentWorldState;
  updateStorageControls();
  showStorageNotice("Loaded the last saved snapshot from this browser.", "info");
}

function clearSnapshot() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    showStorageNotice("Could not clear browser storage from this page.", "error", 7000);
    return;
  }

  sourceText.value = "";
  resolvedOutput.textContent = WAITING_TEXT;
  output.textContent = "{}";
  meta.textContent = "";
  currentWorldState = null;
  currentModel = "";
  currentUsage = null;
  lastSavedAt = "";
  copyButton.disabled = true;
  updateStorageControls();
  showStorageNotice("Snapshot cleared from this browser.", "info");
}

function downloadFullJson() {
  const savedAt = lastSavedAt || new Date().toISOString();
  downloadFile(
    `world-status-${fileDate(savedAt)}.json`,
    JSON.stringify(buildSnapshot(savedAt), null, 2),
    "application/json"
  );
}

function downloadResolvedText() {
  const savedAt = lastSavedAt || new Date().toISOString();
  downloadFile(
    `coreference-resolved-${fileDate(savedAt)}.txt`,
    resolvedOutput.textContent,
    "text/plain;charset=utf-8"
  );
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function fileDate(value) {
  return value.replace(/[:.]/g, "-").slice(0, 19);
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  sourceText.value = await file.text();
  updateStorageControls();
});

sourceText.addEventListener("input", updateStorageControls);
maxChars.addEventListener("input", updateStorageControls);
saveButton.addEventListener("click", saveSnapshot);
loadButton.addEventListener("click", loadSnapshot);
clearButton.addEventListener("click", clearSnapshot);
downloadJsonButton.addEventListener("click", downloadFullJson);
downloadTxtButton.addEventListener("click", downloadResolvedText);

runButton.addEventListener("click", async () => {
  const text = sourceText.value.trim();
  if (!text) {
    output.textContent = "请先输入文本。";
    return;
  }

  setBusy(true);
  copyButton.disabled = true;
  currentWorldState = null;
  currentModel = "";
  currentUsage = null;
  output.textContent = "正在加载 AllenNLP 模型、做共指消解，并调用 DeepSeek 生成本体化世界状态...";
  resolvedOutput.textContent = "处理中...";
  meta.textContent = "";
  updateStorageControls();

  try {
    const response = await fetch("/api/world-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        max_chars: Number(maxChars.value || 1200),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.detail || "请求失败");
    }

    currentWorldState = payload.world_state;
    currentModel = payload.model || "";
    currentUsage = payload.usage || null;
    output.textContent = JSON.stringify(payload.world_state, null, 2);
    resolvedOutput.textContent = payload.resolved_text || "";
    meta.textContent = `${payload.resolved_chunks.length} 个文本块 · ${payload.model}`;
    copyButton.disabled = false;
    saveSnapshot();
  } catch (error) {
    output.textContent = `生成失败：${error.message}`;
    resolvedOutput.textContent = "无结果";
  } finally {
    setBusy(false);
    updateStorageControls();
  }
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(output.textContent);
  copyButton.textContent = "已复制";
  window.setTimeout(() => {
    copyButton.textContent = "复制";
  }, 1200);
});

const initialSnapshot = readStoredSnapshot();
if (initialSnapshot) {
  lastSavedAt = initialSnapshot.savedAt || "";
}
updateStorageControls();
checkHealth();
