const STORAGE_KEY = "trpg-world-status:last-snapshot";
const WAITING_TEXT = "等待生成";

const snowfield = document.querySelector("#snowfield");
const sourceText = document.querySelector("#sourceText");
const fileInput = document.querySelector("#fileInput");
const maxChars = document.querySelector("#maxChars");
const runButton = document.querySelector("#runButton");
const copyButton = document.querySelector("#copyButton");
const output = document.querySelector("#output");
const worldViewDescription = document.querySelector("#worldViewDescription");
const worldViewButtons = document.querySelectorAll("[data-world-view]");
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
const graphFileInput = document.querySelector("#graphFileInput");
const actsOutput = document.querySelector("#actsOutput");
const actsCount = document.querySelector("#actsCount");
const downloadActsButton = document.querySelector("#downloadActsButton");
const downloadGraphButton = document.querySelector("#downloadGraphButton");
const downloadInteractiveGraphButton = document.querySelector("#downloadInteractiveGraphButton");

let currentWorldState = null;
let currentModel = "";
let currentUsage = null;
let lastSavedAt = "";
let noticeTimer = null;
let activeWorldView = "full";
let isBusy = false;
let modelReady = false;

const WORLD_VIEWS = {
  full: {
    label: "完整 JSON",
    fields: null,
  },
  micro: {
    label: "微观层：人物与叙事物件/线索",
    fields: ["characters", "items"],
  },
  meso: {
    label: "中观层：地点、群体行动者与社会关系",
    fields: ["locations", "factions", "relationships"],
  },
  macro: {
    label: "宏观层：弱结构化叙事事件、任务与开放线索",
    fields: ["acts", "timeline", "quests", "open_threads"],
  },
  context: {
    label: "全局语境变量：氛围与当前场景状态",
    fields: ["context_variables"],
  },
};

function createSnowfield() {
  if (!snowfield) {
    return;
  }

  const symbols = ["❄", "❅", "❆", "✻", "·"];
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 78; index += 1) {
    const flake = document.createElement("span");
    const edgePosition = Math.random() < 0.7
      ? (Math.random() < 0.5 ? Math.random() * 25 : 75 + Math.random() * 25)
      : 25 + Math.random() * 50;

    flake.className = "snowflake";
    flake.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    flake.style.setProperty("--snow-x", `${edgePosition.toFixed(2)}vw`);
    flake.style.setProperty("--snow-size", `${(11 + Math.random() * 17).toFixed(1)}px`);
    flake.style.setProperty("--snow-opacity", `${(0.48 + Math.random() * 0.42).toFixed(2)}`);
    flake.style.setProperty("--snow-duration", `${(10 + Math.random() * 15).toFixed(1)}s`);
    flake.style.setProperty("--snow-delay", `${(-Math.random() * 28).toFixed(1)}s`);
    flake.style.setProperty("--snow-drift", `${(-54 + Math.random() * 108).toFixed(1)}px`);
    flake.style.setProperty(
      "--snow-color",
      Math.random() < 0.55 ? "rgba(30, 92, 103, 0.72)" : "rgba(255, 255, 255, 0.96)"
    );
    fragment.appendChild(flake);
  }

  snowfield.appendChild(fragment);
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) throw new Error("health check failed");
    const payload = await response.json();
    const modelStatus = payload.coref_model?.status;
    modelReady = !modelStatus || ["ready", "on_demand", "unavailable"].includes(modelStatus);

    if (modelStatus === "loading" || modelStatus === "pending") {
      health.textContent = "模型预热中";
    } else if (modelStatus === "error") {
      health.textContent = "模型加载失败";
      health.className = "status error";
      setRunButtonState();
      return;
    } else if (modelStatus === "unavailable") {
      health.textContent = "云端生成可用 · 无共指模型";
    } else {
      const seconds = payload.coref_model?.load_seconds;
      health.textContent = seconds ? `模型就绪 · ${seconds}s` : "服务可用";
    }
    health.className = "status ok";
  } catch {
    modelReady = false;
    health.textContent = "服务异常";
    health.className = "status error";
  }
  setRunButtonState();
}

function setBusy(busy) {
  isBusy = busy;
  setRunButtonState();
}

function setRunButtonState() {
  runButton.disabled = isBusy || !modelReady;
  if (isBusy) {
    runButton.textContent = "生成中...";
  } else if (!modelReady) {
    runButton.textContent = "等待模型预热";
  } else {
    runButton.textContent = "生成本体化世界状态";
  }
}

function getVisibleWorldState() {
  if (!currentWorldState || typeof currentWorldState !== "object") {
    return {};
  }

  const view = WORLD_VIEWS[activeWorldView];
  if (!view || !view.fields) {
    return currentWorldState;
  }

  return Object.fromEntries(
    view.fields.map((field) => [field, currentWorldState[field] ?? emptyValueForField(field)])
  );
}

function emptyValueForField(field) {
  return field === "context_variables" ? {} : [];
}

function renderWorldState() {
  output.textContent = JSON.stringify(getVisibleWorldState(), null, 2);
  const view = WORLD_VIEWS[activeWorldView] || WORLD_VIEWS.full;
  worldViewDescription.textContent = `当前显示：${view.label}`;

  worldViewButtons.forEach((button) => {
    const isActive = button.dataset.worldView === activeWorldView;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function renderGraph() {
  window.WorldGraph?.render(currentWorldState);
}

function appendActDetail(container, label, value) {
  if (value === undefined || value === null || value === "") return;
  if (Array.isArray(value) && value.length === 0) return;

  const block = document.createElement("div");
  block.className = "act-detail";
  const heading = document.createElement("strong");
  heading.textContent = label;
  block.appendChild(heading);

  if (Array.isArray(value)) {
    const list = document.createElement("ul");
    value.forEach((item) => {
      const entry = document.createElement("li");
      entry.textContent = typeof item === "string" ? item : JSON.stringify(item);
      list.appendChild(entry);
    });
    block.appendChild(list);
  } else {
    const paragraph = document.createElement("p");
    paragraph.textContent = typeof value === "string" ? value : JSON.stringify(value);
    block.appendChild(paragraph);
  }
  container.appendChild(block);
}

function renderActs() {
  if (!actsOutput || !actsCount) return;
  const acts = Array.isArray(currentWorldState?.acts) ? currentWorldState.acts : [];
  actsOutput.replaceChildren();
  actsCount.textContent = acts.length ? `${acts.length} 幕` : "等待分幕内容";

  if (!acts.length) {
    const empty = document.createElement("p");
    empty.className = "acts-empty";
    empty.textContent = "新生成的 World Status 会在这里按幕和场景细化呈现。";
    actsOutput.appendChild(empty);
    return;
  }

  acts.forEach((act, actIndex) => {
    const article = document.createElement("article");
    article.className = "act-card";
    const header = document.createElement("header");
    const eyebrow = document.createElement("span");
    eyebrow.textContent = `第 ${act.act_number || actIndex + 1} 幕`;
    const title = document.createElement("h3");
    title.textContent = act.title || `未命名幕 ${actIndex + 1}`;
    header.append(eyebrow, title);
    article.appendChild(header);

    appendActDetail(article, "戏剧目的", act.dramatic_purpose);
    appendActDetail(article, "开幕状态", act.opening_state);

    (Array.isArray(act.scenes) ? act.scenes : []).forEach((scene, sceneIndex) => {
      const sceneCard = document.createElement("section");
      sceneCard.className = "scene-card";
      const sceneTitle = document.createElement("h4");
      sceneTitle.textContent = `场景 ${sceneIndex + 1} · ${scene.title || "未命名场景"}`;
      sceneCard.appendChild(sceneTitle);
      appendActDetail(sceneCard, "地点 / 时间", [scene.location, scene.time].filter(Boolean));
      appendActDetail(sceneCard, "参与者", scene.participants);
      appendActDetail(sceneCard, "场景目标", scene.objective);
      appendActDetail(sceneCard, "推进节拍", scene.beats);
      appendActDetail(sceneCard, "冲突", scene.conflict);
      appendActDetail(sceneCard, "揭示", scene.discoveries);
      appendActDetail(sceneCard, "玩家选择", scene.player_choices);
      appendActDetail(sceneCard, "后果", scene.consequences);
      appendActDetail(sceneCard, "转场", scene.transition);
      article.appendChild(sceneCard);
    });

    appendActDetail(article, "人物变化", act.character_changes);
    appendActDetail(article, "本幕线索", act.clues_revealed);
    appendActDetail(article, "未决线索", act.unresolved_threads);
    appendActDetail(article, "闭幕状态", act.closing_state);
    appendActDetail(article, "下一幕钩子", act.next_act_hook);
    actsOutput.appendChild(article);
  });
}

function setWorldView(viewName) {
  if (!WORLD_VIEWS[viewName]) return;
  activeWorldView = viewName;
  renderWorldState();
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
  downloadActsButton.disabled = !Array.isArray(currentWorldState?.acts) || currentWorldState.acts.length === 0;
  downloadGraphButton.disabled = !currentWorldState;
  downloadInteractiveGraphButton.disabled = !currentWorldState;

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
  renderWorldState();
  renderActs();
  renderGraph();
  maxChars.value = snapshot.maxChars || 1200;
  currentModel = snapshot.model || "";
  currentUsage = snapshot.usage || null;
  lastSavedAt = snapshot.savedAt || "";
  meta.textContent = currentModel ? `已载入快照 · ${currentModel}` : "已载入快照";
  copyButton.disabled = !currentWorldState;
  updateStorageControls();
  showStorageNotice("Loaded the last saved snapshot from this browser.", "info");
}

async function importGraphJson(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    currentWorldState = payload.worldState || payload.world_state || payload;
    if (!currentWorldState || typeof currentWorldState !== "object" || Array.isArray(currentWorldState)) {
      throw new Error("未找到有效的 World Status 对象");
    }
    sourceText.value = payload.sourceText || payload.source_text || sourceText.value;
    resolvedOutput.textContent = payload.resolvedText || payload.resolved_text || resolvedOutput.textContent;
    currentModel = payload.model || currentModel;
    currentUsage = payload.usage || currentUsage;
    activeWorldView = "full";
    renderWorldState();
    renderActs();
    renderGraph();
    copyButton.disabled = false;
    updateStorageControls();
    showStorageNotice("已导入 World Status JSON，并生成交互知识图谱。", "success");
  } catch (error) {
    showStorageNotice(`JSON 导入失败：${error.message}`, "error", 7000);
  } finally {
    graphFileInput.value = "";
  }
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
  currentWorldState = null;
  activeWorldView = "full";
  renderWorldState();
  renderActs();
  renderGraph();
  meta.textContent = "";
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

function downloadActs() {
  const savedAt = lastSavedAt || new Date().toISOString();
  downloadFile(
    `world-status-acts-${fileDate(savedAt)}.json`,
    JSON.stringify({ summary: currentWorldState?.summary || "", acts: currentWorldState?.acts || [] }, null, 2),
    "application/json"
  );
}

function downloadGraph() {
  const savedAt = lastSavedAt || new Date().toISOString();
  const svg = window.WorldGraph?.exportSvg();
  if (!svg) {
    showStorageNotice("图谱尚未生成，无法导出。", "error");
    return;
  }
  downloadFile(`world-status-graph-${fileDate(savedAt)}.svg`, svg, "image/svg+xml;charset=utf-8");
}

function downloadInteractiveGraph() {
  const savedAt = lastSavedAt || new Date().toISOString();
  const html = window.WorldGraph?.exportInteractiveHtml();
  if (!html) {
    showStorageNotice("图谱尚未生成，无法导出。", "error");
    return;
  }
  downloadFile(`world-status-graph-${fileDate(savedAt)}.html`, html, "text/html;charset=utf-8");
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
downloadActsButton.addEventListener("click", downloadActs);
downloadGraphButton.addEventListener("click", downloadGraph);
downloadInteractiveGraphButton.addEventListener("click", downloadInteractiveGraph);
graphFileInput.addEventListener("change", () => importGraphJson(graphFileInput.files?.[0]));
worldViewButtons.forEach((button) => {
  button.addEventListener("click", () => setWorldView(button.dataset.worldView));
});

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
  output.textContent = "正在加载 AllenNLP / SpanBERT、做共指消解，并调用 DeepSeek。首次生成可能需要 5-10 分钟，请保持页面打开...";
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
    activeWorldView = "full";
    renderWorldState();
    renderActs();
    renderGraph();
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
renderWorldState();
renderActs();
renderGraph();
createSnowfield();
checkHealth();
window.setInterval(checkHealth, 5000);
