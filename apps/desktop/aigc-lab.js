const API = "http://127.0.0.1:4314"
const $ = (selector) => document.querySelector(selector)

const samples = {
  human: "辰南道：「不许骑着那头色虎到处乱飞，刚才就招来一个莫名其妙的女子，你不想再引来什么恐怖的人物吧？你的困神指力就快到发作期了，你若是到处乱跑，到时受苦可别找我。」\n\n「败类，我要去神风学院。」自从收服小玉后，小公主就不止一次想逃走，但又怕在途中困神指力突然发作。最后她想到了神风学院，传闻里面高手如云，更一些绝世高手隐匿其中，她想求助里面的高手为她解开身体的禁制。",
  ai: "天壁裂缝正以每息三寸的速度扩张，护山大阵的灵力读数从百分之七十二骤降到百分之四十九，所有人的命运都在这一刻被推向不可逆的深渊。陆无良脊背紧贴冰冷岩壁，瞳孔骤然收缩，指节因为过度用力而泛白，他知道局势已经彻底失控。玄默缓慢抬头，薄雾从他的肩胛后方簌簌散开，这意味着新的风险已经形成闭环。",
  mixed: "「别喊。」陆无良把半截铜钱塞回袖口，声音压得很低。墙外有人踩碎了瓦片，他没回头，只伸手按住玄默要拔符的手。天壁裂缝正以每息三寸的速度扩张，护山大阵的灵力读数从百分之七十二骤降到百分之四十九，局势正在形成新的压力闭环。玄默看了他一眼，没问为什么，只把那张破界符折了一道角。"
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function formatScore(value) {
  return typeof value === "number" ? value.toFixed(4) : "—"
}

function scoreClass(entry) {
  if (entry.riskLevel === "high") return "high"
  if (entry.riskLevel === "medium") return "medium"
  if (entry.riskLevel === "low") return "low"
  return "watch"
}

function renderSentence(entry) {
  const signals = Array.isArray(entry.localSignals) && entry.localSignals.length
    ? `<div class="signal-list">${entry.localSignals.map((signal) => `<span>${escapeHtml(signal)}</span>`).join("")}</div>`
    : '<div class="signal-list"><span>无本地解释信号，仅参考模型分数</span></div>'
  return `
    <article class="sentence ${scoreClass(entry)}">
      <header>
        <span>#${escapeHtml(entry.index)} · ${escapeHtml(entry.riskLevel)} · ${escapeHtml(entry.status || "unknown")}</span>
        <span>score ${escapeHtml(formatScore(entry.score))} / ${escapeHtml(formatScore(entry.threshold))}</span>
      </header>
      <blockquote>${escapeHtml(entry.text)}</blockquote>
      <footer>
        ${signals}
        <div>label=${escapeHtml(entry.label || "—")} · confidence=${escapeHtml(formatScore(entry.confidence))} · chars=${escapeHtml(entry.charCount)}</div>
        <div>${escapeHtml(entry.reason || "")}</div>
      </footer>
    </article>
  `
}

function renderResult(result) {
  $("#empty-state").hidden = true
  $("#result-view").hidden = false
  const statusClass = result.passed ? "pass" : result.highRiskCount > 0 ? "fail" : "warn"
  $("#summary").innerHTML = `
    <dl class="metric ${statusClass}"><dt>整体状态</dt><dd>${result.passed ? "通过" : "未通过"}</dd></dl>
    <dl class="metric ${statusClass}"><dt>整体 AI 分</dt><dd>${formatScore(result.score)}</dd></dl>
    <dl class="metric"><dt>阈值</dt><dd>${formatScore(result.threshold)}</dd></dl>
    <dl class="metric ${result.highRiskCount ? "fail" : "pass"}"><dt>高风险句</dt><dd>${result.highRiskCount}</dd></dl>
    <dl class="metric"><dt>耗时</dt><dd>${result.elapsedMs}ms</dd></dl>
  `
  $("#decision-note").className = `decision-note ${statusClass}`
  $("#decision-note").innerHTML = `
    <strong>判定标准：${escapeHtml(result.passPolicy || "—")}</strong>
    <span>${escapeHtml(result.passReason || "")}</span>
  `
  $("#risk-count").textContent = `${result.highRiskCount || 0} / ${result.totalSentences || 0}`
  $("#sentence-count").textContent = `${result.totalSentences || 0}`
  $("#risk-list").innerHTML = Array.isArray(result.highRiskSentences) && result.highRiskSentences.length
    ? result.highRiskSentences.map(renderSentence).join("")
    : '<div class="empty-list">没有超过阈值的问题句。</div>'
  $("#sentence-list").innerHTML = Array.isArray(result.sentences) && result.sentences.length
    ? result.sentences.map(renderSentence).join("")
    : '<div class="empty-list">没有可显示句子。</div>'
  $("#raw-json").textContent = JSON.stringify(result, null, 2)
}

async function detect() {
  const text = $("#input-text").value.trim()
  if (!text) {
    $("#input-text").focus()
    return
  }
  const button = $("#detect-button")
  button.disabled = true
  button.textContent = "检测中…"
  try {
    const response = await fetch(`${API}/aigc-lab/detect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text,
        threshold: Number($("#threshold").value) || 0.8,
        granularity: $("#granularity").value,
        minSegmentChars: Number($("#min-segment-chars").value) || 120,
        policy: $("#policy").value,
      }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`)
    renderResult(payload)
  } catch (error) {
    $("#empty-state").hidden = false
    $("#result-view").hidden = true
    $("#empty-state").textContent = `检测失败：${error.message}`
  } finally {
    button.disabled = false
    button.textContent = "开始检测"
  }
}

$("#detect-button").addEventListener("click", detect)
$("#sample-select").addEventListener("change", (event) => {
  const value = event.target.value
  if (samples[value]) $("#input-text").value = samples[value]
})
$("#input-text").addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") detect()
})
