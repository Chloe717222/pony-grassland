const GRID_COLS = 40;
const GRID_ROWS = 25;
const TOTAL = GRID_COLS * GRID_ROWS;
const ADMIN_PASSWORD = "LIULIAN20260426";
const LOCAL_KEY = "lianlian-bday-data-v1";
const QUIZ_LOG_KEY = "lianlian-quiz-log-v1";
const SURPRISE_VIDEO_URL = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const heroImageEl = document.getElementById("heroImage");
const mosaicEl = document.getElementById("mosaic");
const codeInputEl = document.getElementById("codeInput");
const openBtnEl = document.getElementById("openBtn");
const randomBtnEl = document.getElementById("randomBtn");
const exportBlessingsBtnEl = document.getElementById("exportBlessingsBtn");
const adminKickerBtnEl = document.getElementById("adminKickerBtn");
const modalEl = document.getElementById("contentModal");
const modalTitleEl = document.getElementById("modalTitle");
const modalBodyEl = document.getElementById("modalBody");
const blessingOwnerIdEl = document.getElementById("blessingOwnerId");
const jumpInputEl = document.getElementById("jumpInput");
const jumpBtnEl = document.getElementById("jumpBtn");
const prevBlessingBtnEl = document.getElementById("prevBlessingBtn");
const nextBlessingBtnEl = document.getElementById("nextBlessingBtn");
const emptyTpl = document.getElementById("emptyTemplate");
const loadStatusEl = document.getElementById("loadStatus");
const adminModalEl = document.getElementById("adminModal");
const csvFileEl = document.getElementById("csvFile");
const imageFileEl = document.getElementById("imageFile");
const dataFileEl = document.getElementById("dataFile");
const saveLocalBtnEl = document.getElementById("saveLocalBtn");
const downloadDataBtnEl = document.getElementById("downloadDataBtn");
const clearLocalBtnEl = document.getElementById("clearLocalBtn");
const exportQuizLogBtnEl = document.getElementById("exportQuizLogBtn");
const adminStatusEl = document.getElementById("adminStatus");

const quizEntryBtnEl = document.getElementById("quizEntryBtn");
const quizAccessModalEl = document.getElementById("quizAccessModal");
const quizAccessCloseBtnEl = document.getElementById("quizAccessCloseBtn");
const quizLoveBtnEl = document.getElementById("quizLoveBtn");
const quizMehBtnEl = document.getElementById("quizMehBtn");
const quizNopeBtnEl = document.getElementById("quizNopeBtn");
const quizModalEl = document.getElementById("quizModal");
const quizFormEl = document.getElementById("quizForm");
const quizModalCloseBtnEl = document.getElementById("quizModalCloseBtn");
const quizTitleEl = document.getElementById("quizTitle");
const quizBodyEl = document.getElementById("quizBody");
const quizActionRowEl = document.getElementById("quizActionRow");
const quizSubmitBtnEl = document.getElementById("quizSubmitBtn");
const canvasWrapEl = document.querySelector(".canvas-wrap");

const contentMap = new Map();
const fallbackHero = "https://picsum.photos/seed/lianlian-hero/1200/1500";
const state = { heroImage: fallbackHero };
let quizIndex = 0;
let quizAttemptCount = 0;
let currentModalId = null;
let quizFeedbackTimer = null;
let nextSequentialBlessing = 1;
/** 每题通过后写入，供主图两侧上升祝福随机飘字（仅本地，不上传） */
let quizAnswersForBlessing = [];
const QUIZ_ANSWER_SIDE_MAX_LEN = 80;

function clipBlessingSideText(s) {
  const t = String(s || "").trim().replace(/\s+/g, " ");
  if (t.length <= QUIZ_ANSWER_SIDE_MAX_LEN) return t;
  return `${t.slice(0, QUIZ_ANSWER_SIDE_MAX_LEN)}…`;
}

/** 答题内容与 CSV 混排飘字；字号分开：用户回复略大，CSV 维持原随机区间 */
function getSidesShowerPhraseEntries() {
  const csv = getBlessingTextsFromContent().map((text) => ({ text, source: "csv" }));
  const userUniq = [...new Set(quizAnswersForBlessing.filter(Boolean))];
  if (userUniq.length === 0) return csv;
  const user = userUniq.map((text) => ({ text, source: "user" }));
  return [...user, ...csv];
}

function randomSideFontPx(source) {
  if (source === "user") return 20 + Math.floor(Math.random() * 17);
  return 12 + Math.floor(Math.random() * 21);
}

function normalizeId(raw) {
  const clean = String(raw || "").replace(/[^\d]/g, "");
  if (!clean) return null;
  const n = Number.parseInt(clean, 10);
  if (Number.isNaN(n) || n < 1 || n > TOTAL) return null;
  return n.toString().padStart(4, "0");
}

function parseCsv(text) {
  const cleanText = text.replace(/^\uFEFF/, "");
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    const next = cleanText[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (ch === "," || ch === ";")) {
      current.push(field);
      field = "";
      continue;
    }
    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i += 1;
      current.push(field);
      if (current.some((x) => String(x).trim() !== "")) rows.push(current);
      current = [];
      field = "";
      continue;
    }
    field += ch;
  }
  current.push(field);
  if (current.some((x) => String(x).trim() !== "")) rows.push(current);
  if (rows.length < 2) return [];
  const headers = rows[0].map((x) => String(x).trim());
  return rows.slice(1).map((cols) => {
    const row = {};
    headers.forEach((key, i) => {
      row[key] = (cols[i] || "").trim();
    });
    return row;
  });
}

function pickValue(row, keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== "") return String(row[key]).trim();
  }
  return "";
}

function getPayload() {
  const items = {};
  for (const [id, item] of contentMap.entries()) items[id] = item;
  return {
    version: 1,
    range: { min: 1, max: TOTAL, cols: GRID_COLS, rows: GRID_ROWS },
    heroImage: state.heroImage,
    items,
  };
}

function applyData(data) {
  contentMap.clear();
  const items = data && data.items ? data.items : {};
  for (const [idRaw, item] of Object.entries(items)) {
    const id = normalizeId(idRaw);
    if (!id) continue;
    contentMap.set(id, item);
  }
  state.heroImage = data && data.heroImage ? data.heroImage : fallbackHero;
  heroImageEl.src = state.heroImage;
}

function renderGrid() {
  mosaicEl.innerHTML = "";
  for (let i = 1; i <= TOTAL; i++) {
    const id = i.toString().padStart(4, "0");
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.title = `编号 ${id}`;
    if (contentMap.has(id)) cell.classList.add("has-content");
    cell.addEventListener("click", () => openById(id));
    mosaicEl.appendChild(cell);
  }
}

function renderItem(item) {
  const wrap = document.createElement("div");
  if (item.text) {
    const p = document.createElement("p");
    p.textContent = item.text;
    p.style.marginBottom = "12px";
    wrap.appendChild(p);
  }
  if (item.type === "image" && item.url) {
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.title || "图片祝福";
    wrap.appendChild(img);
  } else if (item.type === "audio" && item.url) {
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = item.url;
    wrap.appendChild(audio);
  } else if (item.type === "video" && item.url) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = item.url;
    wrap.appendChild(video);
  }
  return wrap;
}

function openById(rawId) {
  const id = normalizeId(rawId);
  if (!id) {
    alert("请输入 0001-1000 之间的编号。");
    return;
  }
  modalTitleEl.textContent = `编号 ${id}`;
  currentModalId = id;
  modalBodyEl.innerHTML = "";
  const item = contentMap.get(id);
  if (!item) {
    modalBodyEl.appendChild(emptyTpl.content.cloneNode(true));
    blessingOwnerIdEl.textContent = `祝福ID：${id}`;
  } else {
    if (item.title) {
      const h3 = document.createElement("h3");
      h3.textContent = item.title;
      h3.style.marginTop = "0";
      modalBodyEl.appendChild(h3);
    }
    modalBodyEl.appendChild(renderItem(item));
    const ownerId = item.senderId || item.userId || item.fanId || item.fromId || id;
    blessingOwnerIdEl.textContent = `祝福ID：${ownerId}`;
  }
  jumpInputEl.value = id;
  if (!modalEl.open) modalEl.showModal();
}

function getBlessingIdsSorted() {
  return Array.from(contentMap.keys()).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function gotoNeighborBlessing(step) {
  const ids = getBlessingIdsSorted();
  if (!ids.length) {
    alert("当前没有可浏览的祝福内容。");
    return;
  }

  const current = currentModalId && ids.includes(currentModalId) ? currentModalId : ids[0];
  const idx = ids.indexOf(current);
  const nextIdx = (idx + step + ids.length) % ids.length;
  openById(ids[nextIdx]);
}

function nextSequentialBlessingId() {
  const id = nextSequentialBlessing.toString().padStart(4, "0");
  nextSequentialBlessing += 1;
  if (nextSequentialBlessing > TOTAL) nextSequentialBlessing = 1;
  return id;
}

function exportAllBlessings() {
  const rows = Array.from(contentMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "zh-Hans-CN"))
    .map(([id, item]) => {
      const lines = [
        `编号: ${id}`,
        `类型: ${item.type || ""}`,
        `标题: ${item.title || ""}`,
        `文案: ${item.text || ""}`,
        `链接: ${item.url || ""}`,
      ];
      return lines.join("\n");
    });

  if (!rows.length) {
    alert("当前没有可导出的祝福内容。");
    return;
  }

  const text = rows.join("\n\n--------------------\n\n");
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `全部祝福_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function unlockBlessingExport() {
  if (!exportBlessingsBtnEl) return;
  exportBlessingsBtnEl.classList.remove("hidden");
}

function setAdminStatus(msg) {
  adminStatusEl.textContent = `状态：${msg}`;
}

function getQuizLog() {
  try {
    const raw = localStorage.getItem(QUIZ_LOG_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function pushQuizLog(record) {
  const logs = getQuizLog();
  logs.push(record);
  localStorage.setItem(QUIZ_LOG_KEY, JSON.stringify(logs));
}

function saveToLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(getPayload()));
  setAdminStatus("已保存到当前浏览器。");
}

function importCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) {
    setAdminStatus("CSV 读取失败。");
    return;
  }
  let ok = 0;
  let skip = 0;
  for (const row of rows) {
    const id = normalizeId(pickValue(row, ["id", "ID", "编号", "号码", "序号"]));
    if (!id) {
      skip += 1;
      continue;
    }
    const typeRaw = pickValue(row, ["type", "类型", "内容类型"]).toLowerCase();
    const typeMap = { text: "text", image: "image", audio: "audio", video: "video", 文案: "text", 文字: "text", 图片: "image", 语音: "audio", 音频: "audio", 视频: "video" };
    contentMap.set(id, {
      type: typeMap[typeRaw] || "text",
      title: pickValue(row, ["title", "标题"]),
      text: pickValue(row, ["text", "文案", "祝福", "祝福内容"]),
      url: pickValue(row, ["url", "链接", "资源链接", "媒体链接"]),
      thumbnail: pickValue(row, ["thumbnail", "封面", "缩略图"]),
    });
    ok += 1;
  }
  renderGrid();
  setAdminStatus(`CSV 导入成功 ${ok} 条，跳过 ${skip} 条。`);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function downloadData() {
  const blob = new Blob([JSON.stringify(getPayload(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.json";
  a.click();
  URL.revokeObjectURL(url);
  setAdminStatus("已下载 data.json。");
}

function clearLocal() {
  localStorage.removeItem(LOCAL_KEY);
  setAdminStatus("已清空本地运营数据。刷新后将回到 data.json/演示数据。");
}

/** 题干保持你给的篇幅，语气略柔；回复短而承接题意。 */
const quizQuestions = [
  {
    type: "text",
    prompt: "第1题：写一句送给自己的生日祝福。",
    check: (v) => v.trim().length > 0,
    feedback: "写给自己的话，一定作数。愿你如愿！",
  },
  {
    type: "text",
    prompt: "第2题：我最喜欢自己______。",
    check: (v) => v.trim().length > 0,
    feedback: "这样喜欢自己，真好。",
  },
  {
    type: "text",
    prompt: "第3题：无论发生什么，我都值得______。",
    check: (v) => v.trim().length > 0,
    feedback: "嗯，你值得。",
  },
  {
    type: "text",
    prompt: "第4题：写一件你希望为自己做的事。",
    check: (v) => v.trim().length > 0,
    feedback: "能想着为自己做一件，就很棒。慢慢来。",
  },
  {
    type: "text",
    prompt: "第5题：我很喜欢自己______的一面。",
    check: (v) => v.trim().length > 0,
    feedback: "这一面，本来就好。",
  },
  {
    type: "text",
    prompt: "第6题：遇到困难时，你最想对自己说什么？",
    check: (v) => v.trim().length > 0,
    feedback: "可以的！我们一起。",
  },
  {
    type: "text",
    prompt: "第7题：我会永远______自己。",
    check: (v) => v.trim().length > 0,
    feedback: "愿你一直站自己这边。",
  },
  {
    type: "text",
    prompt: "第8题：写一句最想对自己说的话。",
    check: (v) => v.trim().length > 0,
    feedback: "你值得世上一切美好！",
  },
];

function renderQuizQuestion() {
  const q = quizQuestions[quizIndex];
  quizTitleEl.textContent = `第 ${quizIndex + 1} 题 / 8`;
  quizActionRowEl.classList.remove("hidden");
  if (quizFeedbackTimer) {
    clearTimeout(quizFeedbackTimer);
    quizFeedbackTimer = null;
  }

  if (q.type === "choice") {
    const options = q.options
      .map(
        (op, idx) =>
          `<label><input type="radio" name="quizOption" value="${idx + 1}"> ${String.fromCharCode(65 + idx)}. ${op}</label>`
      )
      .join("<br>");
    quizBodyEl.innerHTML = `<p class="quiz-prompt">${q.prompt}</p><div>${options}</div><p id="quizInlineFeedback" class="quiz-inline-feedback" aria-live="polite"></p>`;
  } else {
    quizBodyEl.innerHTML = `<p class="quiz-prompt">${q.prompt}</p><textarea id="quizTextAnswer" class="quiz-text-input" rows="4" autocomplete="off" placeholder="想写什么、写多长都可以"></textarea><p id="quizInlineFeedback" class="quiz-inline-feedback" aria-live="polite"></p>`;
  }
}

function getQuizAnswer() {
  const q = quizQuestions[quizIndex];
  if (q.type === "choice") {
    const checked = quizBodyEl.querySelector('input[name="quizOption"]:checked');
    return checked ? checked.value : "";
  }
  const field = document.getElementById("quizTextAnswer");
  return field ? String(field.value || "").trim() : "";
}

function startQuizSession() {
  quizIndex = 0;
  quizAnswersForBlessing = [];
  quizSubmitBtnEl.disabled = false;
  renderQuizQuestion();
  quizModalEl.showModal();
}

function showLoveIntroThenStartQuiz() {
  if (quizAccessModalEl.open) quizAccessModalEl.close();
  const popup = document.createElement("dialog");
  popup.style.border = "0";
  popup.style.padding = "0";
  popup.style.background = "transparent";
  popup.innerHTML = `
    <div style="background:rgba(18,22,28,0.94);color:#fff;padding:28px 24px;border-radius:14px;max-width:88vw;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.25);">
      <div style="font-size:48px;line-height:1.1;margin-bottom:12px;">🫶</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:10px;letter-spacing:0.02em;">我们也爱你！</div>
      <div style="font-size:13px;opacity:0.88;line-height:1.55;">接下来就玩几道小题，答完有小惊喜～</div>
    </div>
  `;
  document.body.appendChild(popup);
  popup.showModal();
  setTimeout(() => {
    if (popup.open) popup.close();
    popup.remove();
    startQuizSession();
  }, 3200);
}

function showBlessingLinesThenMeteorRain() {
  const lines = [
    "我们邀请刘恋，一起祝福恋恋。",
    "祝她好好吃饭。",
    "好好睡觉。",
    "好好享受爱与被爱。",
    "好好创作。",
    "相信好好的就会[好好的]。",
    "相信好好的就会[会好的]。",
    "我们爱你！",
    "生日快乐恋恋♥",
  ];
  window.setTimeout(() => {
    const dlg = document.createElement("dialog");
    dlg.className = "blessing-close-dialog";
    const card = document.createElement("div");
    card.className = "blessing-close-card";
    lines.forEach((text) => {
      const p = document.createElement("p");
      p.className = "blessing-reveal-line";
      p.textContent = text;
      card.appendChild(p);
    });
    dlg.appendChild(card);
    document.body.appendChild(dlg);
    dlg.showModal();
    const lineStaggerMs = 2000;
    const holdAllVisibleMs = 5000;
    const ps = card.querySelectorAll(".blessing-reveal-line");
    ps.forEach((p, i) => {
      window.setTimeout(() => p.classList.add("is-visible"), i * lineStaggerMs);
    });
    const closeAt = (lines.length - 1) * lineStaggerMs + holdAllVisibleMs;
    window.setTimeout(() => {
      if (dlg.open) dlg.close();
      dlg.remove();
      startBlessingSongAndRisingShower();
    }, closeAt);
  }, 1000);
}

function getBlessingTextsFromContent() {
  const raw = [];
  for (const item of contentMap.values()) {
    const t = String(item.text || "").trim();
    if (t.length > 0 && t.length <= 120) raw.push(t);
    const title = String(item.title || "").trim();
    if (title.length > 0 && title.length <= 60 && title !== t) raw.push(title);
  }
  const uniq = [...new Set(raw)];
  if (uniq.length === 0) {
    return ["生日快乐", "平安喜乐", "愿你被爱围绕", "天天开心"];
  }
  return uniq;
}

let blessingAudioCtx = null;
let zhuNiShengRiBuffer = null;

/** 《祝你生日快乐》简谱旋律（与常见中文版同调），单遍时长约 14s */
function getZhuNiShengRiNoteList() {
  const G4 = 392;
  const A4 = 440;
  const C5 = 523.25;
  const D5 = 587.33;
  const E5 = 659.25;
  const F5 = 698.46;
  const G5 = 783.99;
  return [
    [G4, 0.0, 0.36],
    [G4, 0.4, 0.36],
    [A4, 0.82, 0.36],
    [G4, 1.24, 0.36],
    [C5, 1.66, 0.68],
    [B4, 2.4, 0.68],
    [G4, 3.35, 0.36],
    [G4, 3.75, 0.36],
    [A4, 4.15, 0.36],
    [G4, 4.55, 0.36],
    [D5, 4.95, 0.68],
    [C5, 5.7, 0.68],
    [G4, 6.55, 0.36],
    [G4, 6.95, 0.36],
    [G5, 7.35, 0.36],
    [E5, 7.75, 0.36],
    [C5, 8.15, 0.36],
    [B4, 8.55, 0.36],
    [A4, 8.95, 0.68],
    [F5, 9.8, 0.36],
    [F5, 10.2, 0.36],
    [E5, 10.6, 0.36],
    [C5, 11.0, 0.36],
    [D5, 11.4, 0.36],
    [C5, 11.8, 1.05],
  ];
}

async function ensureZhuNiShengRiBuffer() {
  if (zhuNiShengRiBuffer) return zhuNiShengRiBuffer;
  const sampleRate = 44100;
  const phraseSec = 14.2;
  const offline = new OfflineAudioContext(1, Math.ceil(sampleRate * phraseSec), sampleRate);
  const notes = getZhuNiShengRiNoteList();
  for (const [freq, t, dur] of notes) {
    const osc = offline.createOscillator();
    const g = offline.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.14, t + 0.035);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(offline.destination);
    osc.start(t);
    osc.stop(t + dur + 0.06);
  }
  zhuNiShengRiBuffer = await offline.startRendering();
  return zhuNiShengRiBuffer;
}

/** 在用户手势里解锁 Web Audio，否则十余秒后再播会被浏览器拦截 */
function primeBlessingWebAudio() {
  blessingAudioCtx = blessingAudioCtx || new AudioContext();
  if (blessingAudioCtx.state === "suspended") {
    blessingAudioCtx.resume().catch(() => {});
  }
}

function startBlessingSongAndRisingShower() {
  primeBlessingWebAudio();
  const fallbackMs = 120000;
  void (async () => {
    try {
      const buf = await ensureZhuNiShengRiBuffer();
      const ctx = blessingAudioCtx;
      if (!ctx) {
        startBlessingSidesShower(fallbackMs, null, null);
        return;
      }
      const loops = 4;
      const durationMs = Math.floor(buf.duration * loops * 1000);
      if (ctx.state === "suspended") await ctx.resume();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const master = ctx.createGain();
      master.gain.value = 0.32;
      src.connect(master);
      master.connect(ctx.destination);
      src.start(0);
      const control = {
        stop() {
          try {
            src.stop();
          } catch (_) {
            /* ignore */
          }
          src.disconnect();
          master.disconnect();
        },
      };
      startBlessingSidesShower(durationMs, null, control);
    } catch {
      startBlessingSidesShower(fallbackMs, null, null);
    }
  })();
}

function startBlessingSidesShower(durationMs, songMedia, songControl) {
  const mount = canvasWrapEl;
  if (!mount) return;

  const entries = getSidesShowerPhraseEntries();
  const layer = document.createElement("div");
  layer.className = "blessing-sides-layer";
  layer.setAttribute("aria-hidden", "true");
  mount.appendChild(layer);

  let stopped = false;
  let intervalId = 0;
  const finishSpawn = () => {
    if (stopped) return;
    stopped = true;
    if (intervalId) window.clearInterval(intervalId);
    if (songMedia) {
      try {
        songMedia.pause();
      } catch (_) {
        /* ignore */
      }
    }
    if (songControl && typeof songControl.stop === "function") {
      songControl.stop();
    }
    window.setTimeout(() => layer.remove(), 3200);
  };

  if (songMedia) {
    songMedia.addEventListener("ended", finishSpawn, { once: true });
  }

  const t0 = Date.now();
  intervalId = window.setInterval(() => {
    if (stopped) return;
    if (Date.now() - t0 >= durationMs) {
      finishSpawn();
      return;
    }
    if (Math.random() < 0.58 && entries.length > 0) {
      const pick = entries[Math.floor(Math.random() * entries.length)];
      const el = document.createElement("div");
      el.className = pick.source === "user" ? "blessing-side-line blessing-side-line--user" : "blessing-side-line";
      el.textContent = pick.text;
      el.style.fontSize = `${randomSideFontPx(pick.source)}px`;
      const fromLeft = Math.random() < 0.5;
      if (fromLeft) {
        el.style.left = `${1 + Math.random() * 9}%`;
        el.style.right = "auto";
        el.style.textAlign = "left";
      } else {
        el.style.right = `${1 + Math.random() * 9}%`;
        el.style.left = "auto";
        el.style.textAlign = "right";
      }
      const dur = 2.2 + Math.random() * 2.2;
      el.style.animationDuration = `${dur}s`;
      layer.appendChild(el);
      window.setTimeout(() => el.remove(), dur * 1000 + 120);
    }
  }, 110);
}

function afterGiftContinue() {
  if (quizModalEl.open) quizModalEl.close();
  unlockBlessingExport();
  primeBlessingWebAudio();
  showBlessingLinesThenMeteorRain();
}

function unlockSurprise() {
  quizTitleEl.textContent = "🎉 解锁成功";
  quizBodyEl.innerHTML = `
    <div class="quiz-unlock-wrap">
      <p class="quiz-unlock-celebrate">你棒棒！</p>
    </div>
  `;
  quizSubmitBtnEl.disabled = true;
  quizActionRowEl.classList.add("hidden");
  launchFireworks();
  setTimeout(() => {
    quizBodyEl.innerHTML = `
      <p>恭喜全部答对，惊喜视频已解锁：</p>
      <video id="surpriseVideo" controls autoplay playsinline style="width:100%;border-radius:8px;" src="${SURPRISE_VIDEO_URL}"></video>
      <div class="controls" style="margin-top:10px;">
        <button id="quizAfterGiftBtn" type="button">我看完视频啦，继续</button>
      </div>
    `;
    const video = document.getElementById("surpriseVideo");
    if (video) video.play().catch(() => {});
    const afterBtn = document.getElementById("quizAfterGiftBtn");
    if (afterBtn) {
      afterBtn.addEventListener("click", afterGiftContinue);
    }
  }, 2500);
}

function submitQuiz() {
  const q = quizQuestions[quizIndex];
  const answer = getQuizAnswer();
  const pass = q.check(answer, q);
  quizAttemptCount += 1;
  pushQuizLog({
    at: new Date().toISOString(),
    attemptNo: quizAttemptCount,
    questionNo: quizIndex + 1,
    prompt: q.prompt,
    answer,
    pass,
  });
  if (!pass) {
    const fb = document.getElementById("quizInlineFeedback");
    if (fb) {
      fb.className = "quiz-inline-feedback quiz-inline-feedback--hint";
      const emptyText = q.type === "text" && String(answer || "").trim() === "";
      fb.textContent = emptyText
        ? "答案未设置留存，请放心自由地回答哦~"
        : "这里只有你看见，随便留点什么、给自己鼓鼓劲就好～一个字或一个表情也行。";
    }
    quizSubmitBtnEl.disabled = true;
    quizFeedbackTimer = setTimeout(() => {
      quizSubmitBtnEl.disabled = false;
      renderQuizQuestion();
    }, 2000);
    return;
  }
  {
    const fb = document.getElementById("quizInlineFeedback");
    if (fb) {
      fb.className = "quiz-inline-feedback";
      fb.textContent = q.feedback;
    }
  }
  const clipped = clipBlessingSideText(answer);
  if (clipped.length > 0) quizAnswersForBlessing.push(clipped);
  quizSubmitBtnEl.disabled = true;
  if (quizIndex === quizQuestions.length - 1) {
    quizFeedbackTimer = setTimeout(() => {
      quizSubmitBtnEl.disabled = false;
      unlockSurprise();
    }, 2000);
  } else {
    quizFeedbackTimer = setTimeout(() => {
      quizSubmitBtnEl.disabled = false;
      quizIndex += 1;
      renderQuizQuestion();
    }, 2000);
  }
}

function launchFireworks() {
  const layer = document.createElement("div");
  layer.className = "fireworks-layer";
  quizBodyEl.appendChild(layer);
  const colors = ["#ff6b6b", "#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#c7a86b"];
  const bursts = 8;
  for (let b = 0; b < bursts; b++) {
    const cx = 20 + Math.random() * 60;
    const cy = 18 + Math.random() * 52;
    for (let i = 0; i < 16; i++) {
      const s = document.createElement("span");
      s.className = "spark";
      const angle = (Math.PI * 2 * i) / 16;
      const dist = 24 + Math.random() * 30;
      s.style.left = `${cx}%`;
      s.style.top = `${cy}%`;
      s.style.background = colors[(i + b) % colors.length];
      s.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      s.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
      s.style.animationDelay = `${b * 120}ms`;
      layer.appendChild(s);
    }
  }
  setTimeout(() => layer.remove(), 2200);
}

function exportQuizLog() {
  const logs = getQuizLog();
  const payload = {
    exportedAt: new Date().toISOString(),
    totalAttempts: logs.length,
    records: logs,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quiz-log.json";
  a.click();
  URL.revokeObjectURL(url);
  setAdminStatus(`已导出答题记录，共 ${logs.length} 条。`);
}

function showTimedPopup(message, duration = 5000) {
  const popup = document.createElement("dialog");
  popup.style.border = "0";
  popup.style.padding = "0";
  popup.style.background = "transparent";
  popup.innerHTML = `
    <div style="background:rgba(18,22,28,0.92);color:#fff;padding:14px 18px;border-radius:10px;box-shadow:0 12px 28px rgba(0,0,0,0.22);font-size:14px;max-width:86vw;text-align:center;">
      ${message}
    </div>
  `;
  document.body.appendChild(popup);
  popup.showModal();
  setTimeout(() => {
    if (popup.open) popup.close();
    popup.remove();
  }, duration);
}

async function loadData() {
  const local = localStorage.getItem(LOCAL_KEY);
  if (local) {
    try {
      applyData(JSON.parse(local));
      renderGrid();
      loadStatusEl.textContent = "";
      return;
    } catch {
      localStorage.removeItem(LOCAL_KEY);
    }
  }
  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("data.json missing");
    applyData(await res.json());
    loadStatusEl.textContent = "已读取 data.json 最新内容。";
  } catch {
    applyData({
      heroImage: fallbackHero,
      items: {
        "0001": { type: "text", title: "生日快乐", text: "愿你平安喜乐，万事顺心。" },
        "0007": { type: "image", title: "粉丝手绘", text: "示例图片祝福", url: "https://picsum.photos/seed/bday-a/960/1200" },
      },
    });
    loadStatusEl.textContent = "读取 data.json 失败，当前显示演示数据。";
  }
  renderGrid();
}

openBtnEl.addEventListener("click", () => openById(codeInputEl.value));
randomBtnEl.addEventListener("click", () => openById(nextSequentialBlessingId()));
exportBlessingsBtnEl.addEventListener("click", exportAllBlessings);
jumpBtnEl.addEventListener("click", () => openById(jumpInputEl.value));
prevBlessingBtnEl.addEventListener("click", () => gotoNeighborBlessing(-1));
nextBlessingBtnEl.addEventListener("click", () => gotoNeighborBlessing(1));
codeInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") openById(codeInputEl.value);
});
jumpInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") openById(jumpInputEl.value);
  if (e.key === "ArrowLeft") gotoNeighborBlessing(-1);
  if (e.key === "ArrowRight") gotoNeighborBlessing(1);
});

if (adminKickerBtnEl) {
  adminKickerBtnEl.addEventListener("click", () => {
    alert("这里是后台管理入口，非运营同学请返回主页哦～");
    const pwd = prompt("请输入后台管理密码");
    if (pwd !== ADMIN_PASSWORD) {
      alert("密码错误。");
      return;
    }
    adminModalEl.showModal();
    setAdminStatus("已进入运营模式。");
  });
}

csvFileEl.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  importCsv(await file.text());
});

imageFileEl.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  state.heroImage = await fileToDataUrl(file);
  heroImageEl.src = state.heroImage;
  setAdminStatus("底图已更新。");
});

dataFileEl.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    applyData(json);
    renderGrid();
    setAdminStatus("data.json 导入成功，当前页面已更新。");
    loadStatusEl.textContent = "当前显示导入的数据（尚未保存到浏览器）。";
  } catch {
    setAdminStatus("data.json 导入失败，请确认文件格式。");
  }
});

saveLocalBtnEl.addEventListener("click", saveToLocal);
downloadDataBtnEl.addEventListener("click", downloadData);
clearLocalBtnEl.addEventListener("click", clearLocal);
exportQuizLogBtnEl.addEventListener("click", exportQuizLog);

quizSubmitBtnEl.addEventListener("click", submitQuiz);

if (quizFormEl) {
  quizFormEl.addEventListener("submit", (e) => {
    e.preventDefault();
    if (quizSubmitBtnEl.disabled) return;
    submitQuiz();
  });
}

if (quizModalCloseBtnEl) {
  quizModalCloseBtnEl.addEventListener("click", () => {
    quizModalEl.close("cancel");
  });
}

quizEntryBtnEl.addEventListener("click", () => {
  primeBlessingWebAudio();
  quizAccessModalEl.showModal();
});

if (quizAccessCloseBtnEl) {
  quizAccessCloseBtnEl.addEventListener("click", () => {
    if (quizAccessModalEl.open) quizAccessModalEl.close();
  });
}

if (quizLoveBtnEl) {
  quizLoveBtnEl.addEventListener("click", () => {
    showLoveIntroThenStartQuiz();
  });
}

if (quizMehBtnEl) {
  quizMehBtnEl.addEventListener("click", () => {
    showTimedPopup("那你再想想呢", 3500);
  });
}

if (quizNopeBtnEl) {
  quizNopeBtnEl.addEventListener("click", () => {
    if (quizAccessModalEl.open) quizAccessModalEl.close();
    showTimedPopup("<span style=\"font-size:52px;line-height:1;display:block\">🙂</span>", 3500);
  });
}

quizModalEl.addEventListener("close", () => {
  if (quizModalEl.returnValue === "cancel") {
    launchFireworks();
  }
});

loadData();
