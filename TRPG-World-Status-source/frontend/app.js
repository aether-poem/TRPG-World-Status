const sourceText = document.querySelector("#sourceText");
const fileInput = document.querySelector("#fileInput");
const maxChars = document.querySelector("#maxChars");
const runButton = document.querySelector("#runButton");
const copyButton = document.querySelector("#copyButton");
const output = document.querySelector("#output");
const resolvedOutput = document.querySelector("#resolvedOutput");
const meta = document.querySelector("#meta");
const health = document.querySelector("#health");

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
  runButton.textContent = isBusy ? "生成中..." : "生成世界状态";
}

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  sourceText.value = await file.text();
});

runButton.addEventListener("click", async () => {
  const text = sourceText.value.trim();
  if (!text) {
    output.textContent = "请先输入文本。";
    return;
  }

  setBusy(true);
  copyButton.disabled = true;
  output.textContent = "正在加载 AllenNLP 模型、做共指消解，并调用 DeepSeek...";
  resolvedOutput.textContent = "处理中";
  meta.textContent = "";

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

    output.textContent = JSON.stringify(payload.world_state, null, 2);
    resolvedOutput.textContent = payload.resolved_text || "";
    meta.textContent = `${payload.resolved_chunks.length} 个文本块 · ${payload.model}`;
    copyButton.disabled = false;
  } catch (error) {
    output.textContent = `生成失败：${error.message}`;
    resolvedOutput.textContent = "无结果";
  } finally {
    setBusy(false);
  }
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(output.textContent);
  copyButton.textContent = "已复制";
  window.setTimeout(() => {
    copyButton.textContent = "复制";
  }, 1200);
});

checkHealth();
