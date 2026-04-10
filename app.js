const GRID_COLS = 40;
const GRID_ROWS = 25;
const TOTAL = GRID_COLS * GRID_ROWS;
const ADMIN_PASSWORD = "LIULIAN20260426";
const LOCAL_KEY = "lianlian-bday-data-v1";
/** 彩蛋视频示例路径：与格子一样放在 content/，可自行替换文件 */
const SURPRISE_VIDEO_URL = "./content/surprise.mp4";

/**
 * 六个小彩蛋（刘恋点「爱」后出现标题列表，任选其一）。
 * type: "text" 用 text；"image"|"video"|"audio" 用 src（相对路径或 https）。
 */
const EASTER_EGGS = [
  { title: "彩蛋① · 一段话", type: "text", text: "在这里写你的文字彩蛋～支持多行。\n换行也没问题。" },
  { title: "彩蛋② · 一张图", type: "image", src: "./content/egg_02.jpg" },
  { title: "彩蛋③ · 语音", type: "audio", src: "./content/egg_03.m4a" },
  { title: "彩蛋④ · 视频", type: "video", src: SURPRISE_VIDEO_URL },
  { title: "彩蛋⑤ · 再一段话", type: "text", text: "第二段文字彩蛋，按需改掉即可。" },
  { title: "彩蛋⑥ · 再来一张图", type: "image", src: "./content/egg_06.jpg" },
];

const heroImageEl = document.getElementById("heroImage");
const mosaicEl = document.getElementById("mosaic");
const codeInputEl = document.getElementById("codeInput");
const openBtnEl = document.getElementById("openBtn");
const randomBtnEl = document.getElementById("randomBtn");
const adminKickerBtnEl = document.getElementById("adminKickerBtn");
const modalEl = document.getElementById("contentModal");
const modalBodyEl = document.getElementById("modalBody");
const jumpInputEl = document.getElementById("jumpInput");
const jumpBtnEl = document.getElementById("jumpBtn");
const prevBlessingBtnEl = document.getElementById("prevBlessingBtn");
const nextBlessingBtnEl = document.getElementById("nextBlessingBtn");
const emptyTpl = document.getElementById("emptyTemplate");
const adminModalEl = document.getElementById("adminModal");
const csvFileEl = document.getElementById("csvFile");
const imageFileEl = document.getElementById("imageFile");
const dataFileEl = document.getElementById("dataFile");
const bulkImageFilesEl = document.getElementById("bulkImageFiles");
const saveLocalBtnEl = document.getElementById("saveLocalBtn");
const downloadDataBtnEl = document.getElementById("downloadDataBtn");
const clearLocalBtnEl = document.getElementById("clearLocalBtn");
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
const canvasWrapEl = document.getElementById("canvasWrap") || document.querySelector(".canvas-wrap");
const canvasStageEl = document.getElementById("canvasStage");
const canvasResetBtnEl = document.getElementById("canvasResetBtn");
/** 全屏生日门：完成后写入本地，刷新不再出现（须用函数取节点，避免脚本在 DOM 之前执行得到 null） */
const CEREMONY_STORAGE_KEY = "lianlian-candle-ceremony-v1";
/** 开幕页无操作则自动进入祝福页的等待时长（毫秒） */
const BIRTHDAY_GATE_AUTO_MS = 5000;

function getBirthdayGateEl() {
  return document.getElementById("birthdayGate");
}

let birthdayBlowAnimating = false;
/** 开幕页点击委托：清空本地后需 abort 再重新 bind */
let birthdayGateClickAbort = null;
let birthdayGateAutoEnterTimerId = null;

function clearBirthdayGateAutoEnterTimer() {
  if (birthdayGateAutoEnterTimerId != null) {
    window.clearTimeout(birthdayGateAutoEnterTimerId);
    birthdayGateAutoEnterTimerId = null;
  }
}

function onBirthdayGateAutoEnterTick() {
  birthdayGateAutoEnterTimerId = null;
  try {
    if (localStorage.getItem(CEREMONY_STORAGE_KEY) === "1") return;
    if (!getBirthdayGateEl()) return;
    completeCandleCeremony();
  } catch {
    try {
      localStorage.setItem(CEREMONY_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    syncBirthdayGateVisibility();
  }
}

function scheduleBirthdayGateAutoEnter() {
  clearBirthdayGateAutoEnterTimer();
  birthdayGateAutoEnterTimerId = window.setTimeout(onBirthdayGateAutoEnterTick, BIRTHDAY_GATE_AUTO_MS);
}

const contentMap = new Map();
/** 「仅登记路径」批量上传时创建的预览用 blob: URL，新一批上传前 revoke，避免泄漏与占内存 */
const bulkPreviewObjectUrls = new Set();

function revokeAllBulkPreviewUrls() {
  for (const u of bulkPreviewObjectUrls) {
    try {
      URL.revokeObjectURL(u);
    } catch {
      /* ignore */
    }
  }
  bulkPreviewObjectUrls.clear();
}

/** 无 data.json 主视觉时的占位（不请求外网）；主视觉请在后台上传 */
const HERO_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500"><rect fill="#dfe3e8" width="1200" height="1500"/><text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#9aa0a6" font-family="system-ui,sans-serif" font-size="26">主视觉（后台上传底图）</text></svg>'
  );
const fallbackHero = HERO_PLACEHOLDER_IMAGE;
/** 与 CSV / 运营约定一致：格子配图默认文件名 */
const CONTENT_MEDIA_DIR = "./content";

/**
 * 与 scripts/content-media-exts.mjs 同步（改扩展名时请两处一起改）
 */
const CONTENT_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"];
const CONTENT_AUDIO_EXTS = ["mp3", "m4a", "aac", "wav", "ogg", "opus", "flac"];
const CONTENT_VIDEO_EXTS = ["mp4", "webm", "ogv", "mov", "m4v"];

function contentUrlFor(id, ext) {
  return `${CONTENT_MEDIA_DIR}/${id}.${ext}`;
}

/**
 * 为 false（默认）：`data.json` 里 http(s) 配图/音视频链接原样使用，线上（如 GitHub Pages）可正常加载外链素材。
 * 为 true：外网链改写成 `./content/0001.{首选图扩展名}` 并清空外链音视频——仅当你已把对应文件放进 `content/` 且不想请求外网时使用。
 */
const STRICT_LOCAL_MEDIA_ONLY = false;

/**
 * 为 true：格子在 data.json 里未写 url / imageUrl / thumbnail 时，仍尝试用内链
 * `./content/0001.jpg`（四位编号与格子 id 一致）作为首张候选；加载失败会自动按 CONTENT_IMAGE_EXTS 顺序换扩展名再试。
 * 音频 / 视频在仅有 type、无 url 时同理，按 CONTENT_AUDIO_EXTS / CONTENT_VIDEO_EXTS 链式尝试。
 */
const IMPLICIT_GRID_IMAGE_FROM_CONTENT_DIR = true;

function isHttpUrl(s) {
  return /^https?:\/\//i.test(String(s || "").trim());
}

const state = { heroImage: fallbackHero };
let currentModalId = null;
let nextSequentialBlessing = 1;
/** 与 CSV 混排飘字用；彩蛋直出后通常为空（仅本地，不上传） */
let quizAnswersForBlessing = [];
/** 彩蛋多步弹窗进行中：关弹窗或点「退出」→「我们邀请刘恋…」整段 */
let eggFlowActive = false;

/** 内容与 CSV 混排飘字；字号分开：用户来源略大，CSV 维持原随机区间 */
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
  let s = String(raw || "");
  s = s.replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30));
  const clean = s.replace(/[^\d]/g, "");
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
  const headers = rows[0].map((x) => String(x).trim().replace(/^\uFEFF/, ""));
  return rows.slice(1).map((cols) => {
    const trimmedCols = cols.map((c) => String(c ?? "").trim());
    const row = { __rawCols: trimmedCols };
    headers.forEach((key, i) => {
      row[key] = trimmedCols[i] ?? "";
    });
    return row;
  });
}

/** 五列标准顺序兜底：0 编号 1 文案 2 图片 3 音频 4 视频（表头重复/乱码时仍可读） */
function csvRowCol(row, idx) {
  if (row && Array.isArray(row.__rawCols) && row.__rawCols[idx] != null) {
    return String(row.__rawCols[idx]).trim();
  }
  return "";
}

function pickValue(row, keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== "") return String(row[key]).trim();
  }
  return "";
}

/** CSV 表头因编码乱码时 row['编号'] 可能不存在，用第一列作为编号兜底 */
function pickBlessingIdRaw(row) {
  const fromNamed = pickValue(row, ["id", "ID", "编号", "号码", "序号"]);
  if (fromNamed) return fromNamed;
  const c0 = csvRowCol(row, 0);
  if (c0) return c0;
  for (const v of Object.values(row)) {
    if (Array.isArray(v)) continue;
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function getPayload() {
  const items = {};
  for (const [id, item] of contentMap.entries()) {
    const row = { ...item };
    const img = String(row.imageUrl || "");
    /** blob: 仅用于本页预览；写入 JSON / localStorage 时改回可部署的相对路径 */
    if (img.startsWith("blob:") && row.persistedPath) {
      row.imageUrl = row.persistedPath;
      row.url = row.persistedPath;
    }
    delete row.persistedPath;
    items[id] = row;
  }
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
    contentMap.set(id, normalizeBlessingItem(id, item));
  }
  state.heroImage = data && data.heroImage ? data.heroImage : fallbackHero;
  if (STRICT_LOCAL_MEDIA_ONLY && isHttpUrl(state.heroImage)) state.heroImage = fallbackHero;
  heroImageEl.src = state.heroImage;
}

/**
 * 无配图时的占位：极小的内联 SVG，不发起外网请求，减轻 1000 格负担（同源缓存一条即可）
 */
const GRID_PLACEHOLDER_IMAGE =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect fill="#e8eaed" width="64" height="64"/></svg>'
  );

function fallbackGridImageUrl() {
  return GRID_PLACEHOLDER_IMAGE;
}

/** 判断 `url` 是否更像配图，而非音视频（用于 legacy 数据） */
function looksLikeImageAsset(u) {
  const s = String(u || "").trim();
  if (!s) return false;
  if (s.startsWith("data:image/") || s.startsWith("blob:")) return true;
  if (/\.(mp3|m4a|aac|wav|ogg|opus|flac|mp4|webm|ogv|mov|m4v)(\?|$)/i.test(s)) return false;
  return /\.(jpe?g|png|gif|webp|svg|bmp)(\?|$)/i.test(s);
}

/**
 * 在 STRICT_LOCAL_MEDIA_ONLY 时：把外网演示链改写成 content/ 相对路径并去掉外链音视频。
 * 默认关闭，避免线上托管时因仓库里没有 `./content/0001.jpg` 而导致整格只剩灰块、音视频消失。
 */
function coerceGridItemUrlsToLocalContent(id, raw) {
  if (!raw || typeof raw !== "object") return {};
  if (!STRICT_LOCAL_MEDIA_ONLY) return { ...raw };

  const o = { ...raw };
  const localPic = contentUrlFor(id, CONTENT_IMAGE_EXTS[0]);

  if (isHttpUrl(o.imageUrl)) o.imageUrl = localPic;
  if (isHttpUrl(o.thumbnail)) o.thumbnail = "";

  if (isHttpUrl(o.audioUrl)) o.audioUrl = "";
  if (isHttpUrl(o.videoUrl)) o.videoUrl = "";

  const legacy = String(o.url || "").trim();
  if (isHttpUrl(legacy)) {
    const t = String(o.type || "text").toLowerCase();
    if (t === "audio" || /\.(mp3|m4a|aac|wav|ogg|opus|flac)(\?|$)/i.test(legacy)) {
      o.url = "";
    } else if (t === "video" || /\.(mp4|webm|ogv|mov|m4v)(\?|$)/i.test(legacy)) {
      o.url = "";
    } else if (looksLikeImageAsset(legacy) || t === "image") {
      o.url = localPic;
    } else {
      o.url = "";
    }
  }

  return o;
}

/**
 * 从原始字段解析「配图」URL（不含兜底）；用于 normalize。
 * 优先级：imageUrl → thumbnail → type=image 时的 url → 非音视频类型下、url 像图片时
 */
function extractBlessingImageFromRaw(r) {
  const t = String(r.type || "text").toLowerCase();
  const legacy = String(r.url || "").trim();
  return (
    String(r.imageUrl || "").trim() ||
    String(r.thumbnail || "").trim() ||
    (t === "image" ? legacy : "") ||
    (t !== "audio" && t !== "video" && legacy && looksLikeImageAsset(legacy) ? legacy : "")
  );
}

/** 音频：显式 audioUrl，或 legacy type=audio 时的主 url */
function extractBlessingAudioFromRaw(r) {
  const explicit = String(r.audioUrl || "").trim();
  if (explicit) return explicit;
  const t = String(r.type || "text").toLowerCase();
  const legacy = String(r.url || "").trim();
  if (t === "audio" && legacy) return legacy;
  return "";
}

/** 视频：显式 videoUrl，或 legacy type=video 时的主 url */
function extractBlessingVideoFromRaw(r) {
  const explicit = String(r.videoUrl || "").trim();
  if (explicit) return explicit;
  const t = String(r.type || "text").toLowerCase();
  const legacy = String(r.url || "").trim();
  if (t === "video" && legacy) return legacy;
  return "";
}

/**
 * 归一化每条格子数据（唯一数据源）：
 * - imageUrl：必有（无则占位图），供格子缩略图 + 弹窗大图
 * - text：必有（空则占位文案）
 * - audioUrl / videoUrl：有则弹窗展示对应控件，无则不渲染
 */
function normalizeBlessingItem(id, raw) {
  const r = coerceGridItemUrlsToLocalContent(id, raw && typeof raw === "object" ? raw : {});
  const type = String(r.type || "text").toLowerCase();

  let imageUrl = extractBlessingImageFromRaw(r);
  if (!imageUrl && IMPLICIT_GRID_IMAGE_FROM_CONTENT_DIR) {
    imageUrl = contentUrlFor(id, CONTENT_IMAGE_EXTS[0]);
  }
  if (!imageUrl) imageUrl = fallbackGridImageUrl();

  let text = String(r.text || "").trim();
  const title = String(r.title || "").trim();
  if (!text) text = "（待补充文案）";

  let audioUrl = extractBlessingAudioFromRaw(r);
  let videoUrl = extractBlessingVideoFromRaw(r);
  if (IMPLICIT_GRID_IMAGE_FROM_CONTENT_DIR) {
    if (!audioUrl && type === "audio") audioUrl = contentUrlFor(id, CONTENT_AUDIO_EXTS[0]);
    if (!videoUrl && type === "video") videoUrl = contentUrlFor(id, CONTENT_VIDEO_EXTS[0]);
  }

  let url = String(r.url || "").trim();
  if (!url && imageUrl && type !== "audio" && type !== "video") url = imageUrl;

  const persistedPath = String(r.persistedPath || "").trim();

  return {
    type,
    title,
    text,
    url,
    imageUrl,
    thumbnail: String(r.thumbnail || "").trim(),
    audioUrl,
    videoUrl,
    persistedPath: persistedPath || undefined,
    senderId: r.senderId,
    userId: r.userId,
    fanId: r.fanId,
    fromId: r.fromId,
  };
}

/** 格子与弹窗共用：normalize 后必有 imageUrl；无 item 时用占位 */
function blessingImageSrc(item, id) {
  const u = item && String(item.imageUrl || "").trim();
  if (u) return u;
  return fallbackGridImageUrl();
}

function blessingModalCopyText(item) {
  const t = String(item.text || "").trim();
  return t || "（待补充文案）";
}

/** 弹窗大图 alt：用文案首行摘要，不依赖「标题」字段 */
function modalImageAlt(item) {
  const line = blessingModalCopyText(item).split(/\r?\n/)[0].trim();
  if (!line || line === "（待补充文案）") return "配图";
  return line.length > 48 ? `${line.slice(0, 48)}…` : line;
}

/** 解析当前 URL 在约定扩展列表中的下标；对非 content/{id}.* 的外链返回 -1 */
function contentExtIndexInUrl(src, id, extensions) {
  const pathPart = String(src).split(/[?#]/)[0].toLowerCase();
  const idLower = String(id).toLowerCase();
  for (let i = 0; i < extensions.length; i++) {
    const ext = String(extensions[i]).toLowerCase();
    if (pathPart.endsWith(`/${idLower}.${ext}`) || pathPart.endsWith(`${idLower}.${ext}`)) {
      return i;
    }
  }
  return -1;
}

/** 加载失败时换下一个扩展名；无法继续则返回 null */
function nextContentVariantUrl(failedSrc, id, extensions) {
  const idx = contentExtIndexInUrl(failedSrc, id, extensions);
  if (idx < 0) return null;
  const nextIdx = idx + 1;
  if (nextIdx >= extensions.length) return null;
  return contentUrlFor(id, extensions[nextIdx]);
}

function bindImageContentFallback(img, id) {
  img.addEventListener("error", function onImgChain() {
    const next = nextContentVariantUrl(img.src, id, CONTENT_IMAGE_EXTS);
    if (next) {
      img.src = next;
      return;
    }
    img.removeEventListener("error", onImgChain);
    if (img.src !== GRID_PLACEHOLDER_IMAGE) img.src = GRID_PLACEHOLDER_IMAGE;
  });
}

function bindAudioContentFallback(audio, id) {
  audio.addEventListener("error", function onAudioChain() {
    const next = nextContentVariantUrl(audio.src, id, CONTENT_AUDIO_EXTS);
    if (next) {
      audio.src = next;
      return;
    }
    audio.removeEventListener("error", onAudioChain);
  });
}

function bindVideoContentFallback(video, id) {
  video.addEventListener("error", function onVideoChain() {
    const next = nextContentVariantUrl(video.src, id, CONTENT_VIDEO_EXTS);
    if (next) {
      video.src = next;
      return;
    }
    video.removeEventListener("error", onVideoChain);
  });
}

function buildCellPreviewEl(item, id) {
  const wrap = document.createElement("div");
  wrap.className = "cell-preview-wrap";
  wrap.setAttribute("aria-hidden", "true");

  const img = document.createElement("img");
  img.className = "cell-preview cell-preview--thumb";
  img.src = blessingImageSrc(item, id);
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  bindImageContentFallback(img, id);

  wrap.appendChild(img);
  return wrap;
}

function isMobileGridBatching() {
  try {
    if (typeof window.matchMedia !== "function") return false;
    if (window.matchMedia("(pointer: coarse)").matches) return true;
    if (window.matchMedia("(max-width: 768px)").matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * 移动端一次插入 1000 个格子 + 缩略图易导致 WKWebView/微信内核闪屏、内存尖峰；分帧追加减轻主线程与解码压力。
 */
function renderGrid() {
  mosaicEl.innerHTML = "";
  const chunk = isMobileGridBatching() ? 32 : 250;
  let i = 1;
  function step() {
    const end = Math.min(i + chunk - 1, TOTAL);
    const frag = document.createDocumentFragment();
    for (; i <= end; i++) {
      const id = i.toString().padStart(4, "0");
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      const item = contentMap.get(id);
      cell.classList.toggle("has-content", Boolean(item));
      cell.classList.toggle("cell--placeholder", !item);
      cell.appendChild(buildCellPreviewEl(item, id));
      cell.addEventListener("click", () => openById(id));
      frag.appendChild(cell);
    }
    mosaicEl.appendChild(frag);
    if (i <= TOTAL) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/**
 * 弹窗结构：默认 配图 → 文案 →（可选）音频 →（可选）视频。
 * 若有音频或视频：不展示弹窗大图（配图仅用于格子缩略图）。
 */
function renderBlessingModal(item, cellId) {
  const wrap = document.createElement("div");
  wrap.className = "blessing-modal-body";

  const audioSrc = String(item.audioUrl || "").trim();
  const videoSrc = String(item.videoUrl || "").trim();
  const skipModalImage = Boolean(audioSrc || videoSrc);

  if (!skipModalImage) {
    const img = document.createElement("img");
    img.className = "blessing-modal-image";
    img.src = blessingImageSrc(item, cellId);
    img.alt = modalImageAlt(item);
    img.loading = "eager";
    img.decoding = "async";
    bindImageContentFallback(img, cellId);
    wrap.appendChild(img);
  } else {
    wrap.classList.add("blessing-modal-body--media-only");
  }

  const p = document.createElement("p");
  p.className = "blessing-modal-copy";
  p.textContent = blessingModalCopyText(item);
  p.style.whiteSpace = "pre-wrap";
  wrap.appendChild(p);

  if (audioSrc) {
    const audio = document.createElement("audio");
    audio.className = "blessing-modal-audio";
    audio.controls = true;
    audio.src = audioSrc;
    bindAudioContentFallback(audio, cellId);
    wrap.appendChild(audio);
  }

  if (videoSrc) {
    const video = document.createElement("video");
    video.className = "blessing-modal-video";
    video.controls = true;
    video.playsInline = true;
    video.src = videoSrc;
    bindVideoContentFallback(video, cellId);
    wrap.appendChild(video);
  }

  return wrap;
}

function openById(rawId) {
  const id = normalizeId(rawId);
  if (!id) {
    alert("请输入 0001–1000 之间的四位数字。");
    return;
  }
  currentModalId = id;
  modalBodyEl.innerHTML = "";
  const item = contentMap.get(id);
  if (!item) {
    const placeholder = normalizeBlessingItem(id, {
      type: "image",
      title: "",
      text: "本格尚未导入数据。请在运营后台上传含「文案」与「图片url」的 CSV（如 ./content/0001.jpg），或使用 demo-import.csv 演示。",
      imageUrl: fallbackGridImageUrl(),
      url: fallbackGridImageUrl(),
    });
    modalBodyEl.appendChild(renderBlessingModal(placeholder, id));
  } else {
    modalBodyEl.appendChild(renderBlessingModal(item, id));
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

function setAdminStatus(msg) {
  if (adminStatusEl) adminStatusEl.textContent = `状态：${msg}`;
}

/** 与首页 Happy Birthday 相同：密码通过后打开运营管理弹窗（生日门全屏时也可点） */
function openAdminAfterPasswordPrompt() {
  if (!adminModalEl) {
    alert("未能打开后台：找不到管理弹窗，请刷新页面重试。");
    return;
  }
  alert("这里是后台管理入口，非运营同学请返回主页哦～");
  const pwd = prompt("请输入后台管理密码");
  if (pwd !== ADMIN_PASSWORD) {
    alert("密码错误。");
    return;
  }
  try {
    adminModalEl.showModal();
  } catch (e) {
    alert("无法打开管理窗口，请刷新页面后重试。");
    return;
  }
  setAdminStatus("已进入运营模式。");
}

function syncBirthdayGateVisibility() {
  const gate = getBirthdayGateEl();
  if (!gate) return;
  const done = localStorage.getItem(CEREMONY_STORAGE_KEY) === "1";
  gate.hidden = done;
  if (!done) {
    gate.removeAttribute("hidden");
    gate.removeAttribute("aria-hidden");
  } else {
    gate.setAttribute("hidden", "");
    gate.setAttribute("aria-hidden", "true");
  }
  document.body.style.overflow = done ? "" : "hidden";
}

function resetBirthdayGateCandles() {
  birthdayBlowAnimating = false;
  const gate = getBirthdayGateEl();
  if (!gate) return;
  gate.querySelectorAll(".birthday-gate__candle.is-blown").forEach((el) => {
    el.classList.remove("is-blown");
  });
  const mouth = gate.querySelector(".birthday-gate__mouth");
  if (mouth) mouth.classList.remove("is-blowing");
  const puff = gate.querySelector(".birthday-gate__puff");
  if (puff) puff.classList.remove("is-active");
}

/**
 * 仅由「清空本地」调用：恢复开幕页，但不启动定时自动进入，避免运营清数据后误写入「仪式已完成」。
 * 刷新整页后仍会按正常逻辑自动计时。
 */
function resetBirthdayGateUi() {
  clearBirthdayGateAutoEnterTimer();
  if (birthdayGateClickAbort) {
    birthdayGateClickAbort.abort();
    birthdayGateClickAbort = null;
  }
  const gate = getBirthdayGateEl();
  if (!gate) return;
  gate.classList.remove("birthday-gate--out");
  resetBirthdayGateCandles();
  syncBirthdayGateVisibility();
  initBirthdayGate({ suppressAutoEnter: true });
}

function playBirthdayBlowAnimation(onMidExtinguish) {
  const gate = getBirthdayGateEl();
  const mouth = gate && gate.querySelector(".birthday-gate__mouth");
  const puff = gate && gate.querySelector(".birthday-gate__puff");
  if (mouth) {
    mouth.classList.remove("is-blowing");
    void mouth.offsetWidth;
    mouth.classList.add("is-blowing");
  }
  if (puff) {
    puff.classList.remove("is-active");
    void puff.offsetWidth;
    puff.classList.add("is-active");
  }
  window.setTimeout(() => {
    if (typeof onMidExtinguish === "function") onMidExtinguish();
  }, 220);
  window.setTimeout(() => {
    if (mouth) mouth.classList.remove("is-blowing");
    if (puff) puff.classList.remove("is-active");
  }, 520);
}

function onBirthdayGateDelegatedClick(e) {
  const gate = getBirthdayGateEl();
  if (!gate) return;
  const cakeBtn = e.target.closest("#birthdayGateCakeBtn");
  if (!cakeBtn || !gate.contains(cakeBtn)) return;
  clearBirthdayGateAutoEnterTimer();
  e.preventDefault();
  if (birthdayBlowAnimating) return;
  birthdayBlowAnimating = true;
  playBirthdayBlowAnimation(() => {
    const g = getBirthdayGateEl();
    const el = g && g.querySelector(".birthday-gate__candle");
    if (el) el.classList.add("is-blown");
  });
  window.setTimeout(() => {
    birthdayBlowAnimating = false;
    completeCandleCeremony();
  }, 560);
}

function completeCandleCeremony() {
  clearBirthdayGateAutoEnterTimer();
  const gate = getBirthdayGateEl();
  if (!gate || localStorage.getItem(CEREMONY_STORAGE_KEY) === "1") return;
  try {
    localStorage.setItem(CEREMONY_STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
  const finalize = () => {
    const g = getBirthdayGateEl();
    if (g) g.classList.remove("birthday-gate--out");
    resetBirthdayGateCandles();
    syncBirthdayGateVisibility();
  };
  gate.classList.add("birthday-gate--out");
  window.setTimeout(finalize, 480);
}

function initBirthdayGate(options = {}) {
  const gate = getBirthdayGateEl();
  if (!gate) return;

  syncBirthdayGateVisibility();

  if (localStorage.getItem(CEREMONY_STORAGE_KEY) === "1") {
    clearBirthdayGateAutoEnterTimer();
    return;
  }

  if (birthdayGateClickAbort) {
    birthdayGateClickAbort.abort();
    birthdayGateClickAbort = null;
  }
  birthdayGateClickAbort = new AbortController();
  /** 委托在 #birthdayGate 上，蛋糕内任意子元素点击也能命中 */
  gate.addEventListener("click", onBirthdayGateDelegatedClick, { signal: birthdayGateClickAbort.signal });
  if (!options.suppressAutoEnter) {
    scheduleBirthdayGateAutoEnter();
  }
}

function saveToLocal() {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(getPayload()));
    setAdminStatus("已保存到当前浏览器。");
  } catch (e) {
    const msg = e && e.name === "QuotaExceededError" ? "超出浏览器存储上限。" : String(e && e.message ? e.message : e);
    setAdminStatus(`保存失败：${msg} 若使用「嵌入 Base64」批量图，请改「仅登记路径」并配合 media 文件夹，或改用下载 data.json。`);
    alert(`保存失败：${msg}`);
  }
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
    const id = normalizeId(pickBlessingIdRaw(row));
    if (!id) {
      skip += 1;
      continue;
    }
    const typeRaw = pickValue(row, ["type", "类型", "内容类型"]).toLowerCase();
    const typeMap = { text: "text", image: "image", audio: "audio", video: "video", 文案: "text", 文字: "text", 图片: "image", 语音: "audio", 音频: "audio", 视频: "video" };
    let imageUrl = pickValue(row, [
      "imageUrl",
      "image_url",
      "图片url",
      "图片URL",
      "图片链接",
      "主图",
      "图片地址",
    ]);
    let audioUrl = pickValue(row, ["audioUrl", "audio_url", "音频url", "音频URL", "音频链接", "音频"]);
    let videoUrl = pickValue(row, ["videoUrl", "video_url", "视频url", "视频URL", "视频链接", "视频"]);
    if (!imageUrl) imageUrl = csvRowCol(row, 2);
    if (!audioUrl) audioUrl = csvRowCol(row, 3);
    if (!videoUrl) videoUrl = csvRowCol(row, 4);
    const legacyUrl = pickValue(row, ["url", "链接", "资源链接", "媒体链接"]);
    const type = typeMap[typeRaw] || "text";
    const url = imageUrl || legacyUrl || "";
    let text = pickValue(row, ["text", "文案", "祝福", "祝福内容", "陌"]);
    if (!text) text = csvRowCol(row, 1);
    const rowItem = {
      type,
      title: pickValue(row, ["title", "标题"]),
      text,
      url,
      imageUrl: imageUrl || "",
      thumbnail: pickValue(row, ["thumbnail", "封面", "缩略图"]),
      audioUrl: audioUrl || "",
      videoUrl: videoUrl || "",
    };
    contentMap.set(id, normalizeBlessingItem(id, rowItem));
    ok += 1;
  }
  renderGrid();
  let msg = `CSV 导入成功 ${ok} 条，跳过 ${skip} 条。`;
  if (ok === 0 && skip > 0) {
    msg +=
      " 未识别编号：请确认首列为四位数字；若表头为乱码，请用 Excel「CSV UTF-8」或记事本另存为 UTF-8 后再导入。";
  }
  setAdminStatus(msg);
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

async function clearLocal() {
  localStorage.removeItem(LOCAL_KEY);
  localStorage.removeItem(CEREMONY_STORAGE_KEY);
  /** 原生 dialog 在顶层，不关会盖住开幕页，看起来像「门没了」 */
  if (adminModalEl && adminModalEl.open) {
    try {
      adminModalEl.close();
    } catch {
      /* ignore */
    }
  }
  resetBirthdayGateUi();
  await loadData();
  setAdminStatus(
    "已清空本地运营数据（含开幕状态）。开幕页已重新出现：请点蛋糕进入；本次不会自动跳过（防误记为已完成）。刷新页面后约 5 秒无操作会自动进入。"
  );
}

/** 前情提要里点「爱」后：不再答题，直接你棒棒 + 彩蛋视频 */
function escapeHtmlEgg(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttrEgg(s) {
  return String(s ?? "").replace(/"/g, "&quot;");
}

function showEggTitlePicker() {
  if (!quizBodyEl || !quizTitleEl) return;
  quizTitleEl.textContent = "选一个彩蛋～";
  const btns = EASTER_EGGS.map(
    (egg, i) =>
      `<button type="button" class="egg-picker-btn" data-egg-index="${i}">${escapeHtmlEgg(egg.title)}</button>`
  ).join("");
  quizBodyEl.innerHTML = `<p class="egg-picker-hint">点标题打开对应彩蛋（文字 / 图 / 语音 / 视频）。</p><div class="egg-picker-grid">${btns}</div>`;
  quizBodyEl.querySelectorAll(".egg-picker-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-egg-index"));
      openEasterEggAtIndex(i);
    });
  });
}

function openEasterEggAtIndex(index) {
  const egg = EASTER_EGGS[index];
  if (!egg || !quizBodyEl || !quizTitleEl) return;
  quizTitleEl.textContent = egg.title;
  let media = "";
  if (egg.type === "text") {
    const body = escapeHtmlEgg(egg.text || "").replace(/\n/g, "<br>");
    media = `<div class="egg-text-block">${body}</div>`;
  } else if (egg.type === "image") {
    const src = escapeAttrEgg(egg.src || "");
    media = `<img class="egg-media egg-media--img" src="${src}" alt="" loading="lazy">`;
  } else if (egg.type === "video") {
    const src = escapeAttrEgg(egg.src || "");
    media = `<video class="egg-media egg-media--video" controls playsinline src="${src}"></video>`;
  } else if (egg.type === "audio") {
    const src = escapeAttrEgg(egg.src || "");
    media = `<p class="egg-audio-caption">语音彩蛋</p><audio class="egg-media egg-media--audio" controls src="${src}"></audio>`;
  } else {
    media = `<p class="egg-unknown-type">未知类型彩蛋</p>`;
  }
  quizBodyEl.innerHTML = `<div class="egg-view">${media}</div><div class="egg-after"><p class="egg-after-q">还要看下一个彩蛋吗？</p><div class="egg-after-btns"><button type="button" class="egg-btn-next" id="eggBtnNext">换一个</button><button type="button" class="egg-btn-exit ghost" id="eggBtnExit">退出</button></div></div>`;
  const vid = quizBodyEl.querySelector("video");
  if (vid) vid.play().catch(() => {});
  const nextBtn = document.getElementById("eggBtnNext");
  const exitBtn = document.getElementById("eggBtnExit");
  if (nextBtn) nextBtn.addEventListener("click", () => showEggTitlePicker());
  if (exitBtn) exitBtn.addEventListener("click", () => quizModalEl && quizModalEl.close());
}

function showEggSurpriseFromAccess() {
  if (quizAccessModalEl && quizAccessModalEl.open) quizAccessModalEl.close();
  quizAnswersForBlessing = [];
  if (quizSubmitBtnEl) quizSubmitBtnEl.disabled = true;
  if (quizActionRowEl) quizActionRowEl.classList.add("hidden");
  eggFlowActive = true;
  if (quizModalEl) quizModalEl.showModal();
  showEggTitlePicker();
}

function showBlessingLinesThenMeteorRain() {
  const lines = [
    "今天我们齐聚在这里",
    "是想一起祝福刘恋",
    "祝她好好吃饭",
    "好好睡觉",
    "好好享受爱与被爱",
    "好好创作",
    "相信好好的就会「好好的」",
    "相信好好的就会「会好的」",
    "我们爱你",
    "恋姐生日快乐",
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
      return;
    } catch {
      localStorage.removeItem(LOCAL_KEY);
    }
  }
  try {
    const res = await fetch("./data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("data.json missing");
    applyData(await res.json());
  } catch {
    applyData({
      heroImage: fallbackHero,
      items: {
        "0001": { type: "text", text: "愿你平安喜乐，万事顺心。（演示：无图时用灰色占位，不请求外网。）" },
      },
    });
  }
  renderGrid();
}

/** 须先于其它 addEventListener：若后面任一处抛错，仍能保证生日门已绑定 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initBirthdayGate, { once: true });
} else {
  initBirthdayGate();
}

openBtnEl.addEventListener("click", () => openById(codeInputEl.value));
randomBtnEl.addEventListener("click", () => openById(nextSequentialBlessingId()));
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
  adminKickerBtnEl.addEventListener("click", () => openAdminAfterPasswordPrompt());
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

function getBulkImageMode() {
  const r = document.querySelector('input[name="bulkImageMode"]:checked');
  return r && r.value === "dataurl" ? "dataurl" : "relative";
}

/** 与 CSV、批量选图一致：项目内内容文件夹名，如 content → ./content/0001.jpg */
function getBulkContentSubdir() {
  const el = document.getElementById("bulkContentFolder");
  let s = el && String(el.value || "").trim();
  if (!s) s = "content";
  s = s.replace(/^[./\\]+/g, "").replace(/[/\\]+$/g, "").replace(/\\/g, "/");
  if (!s || s.includes("..")) return "content";
  return s;
}

if (bulkImageFilesEl) {
  bulkImageFilesEl.addEventListener("change", async (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    const mode = getBulkImageMode();
    revokeAllBulkPreviewUrls();
    let ok = 0;
    let skip = 0;
    let bytesApprox = 0;
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        skip += 1;
        continue;
      }
      const base = file.name.replace(/\.[^/.]+$/, "");
      const id = normalizeId(base);
      if (!id) {
        skip += 1;
        continue;
      }
      const extMatch = /\.([a-z0-9]+)$/i.exec(file.name);
      const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : ".jpg";
      if (mode === "relative") {
        const sub = getBulkContentSubdir();
        const persistPath = `./${sub}/${id}${ext}`;
        /** 浏览器不会把「选择的文件」自动写到服务器/磁盘上的 media/，直接只用路径会导致 404；用 object URL 先在本页显示 */
        const blobUrl = URL.createObjectURL(file);
        bulkPreviewObjectUrls.add(blobUrl);
        contentMap.set(
          id,
          normalizeBlessingItem(id, {
            type: "image",
            title: "",
            text: "",
            url: persistPath,
            imageUrl: blobUrl,
            persistedPath: persistPath,
          })
        );
        ok += 1;
      } else {
        const dataUrl = await fileToDataUrl(file);
        bytesApprox += dataUrl.length;
        contentMap.set(
          id,
          normalizeBlessingItem(id, {
            type: "image",
            title: "",
            text: "",
            url: dataUrl,
            imageUrl: dataUrl,
          })
        );
        ok += 1;
      }
    }
    renderGrid();
    if (ok === 0) {
      alert(
        "没有成功导入任何图片。请检查：① 是否为图片文件；② 文件名是否对应 0001–1000（如 0001.jpg、42.png）。纯中文或过长数字的文件名会无法识别编号。"
      );
    }
    if (mode === "dataurl") {
      const mb = bytesApprox / (1024 * 1024);
      setAdminStatus(
        `已嵌入 ${ok} 张为 Base64，跳过 ${skip} 个。约 ${mb.toFixed(1)} MB；体积过大时请改用「仅登记路径」+ 内容文件夹。`
      );
    } else {
      const sub = getBulkContentSubdir();
      setAdminStatus(
        `已处理 ${ok} 张：本页已预览；data.json 中为 ./${sub}/ 路径。部署时请把「${sub}」文件夹与网页放在同一目录。跳过 ${skip} 个。`
      );
    }
    e.target.value = "";
  });
}

dataFileEl.addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    applyData(json);
    renderGrid();
    setAdminStatus("data.json 导入成功，当前页面已更新。");
  } catch {
    setAdminStatus("data.json 导入失败，请确认文件格式。");
  }
});

saveLocalBtnEl.addEventListener("click", saveToLocal);
downloadDataBtnEl.addEventListener("click", downloadData);
clearLocalBtnEl.addEventListener("click", clearLocal);

if (quizModalCloseBtnEl) {
  quizModalCloseBtnEl.addEventListener("click", () => {
    quizModalEl.close("cancel");
  });
}

if (quizEntryBtnEl && quizAccessModalEl) {
  quizEntryBtnEl.addEventListener("click", () => {
    primeBlessingWebAudio();
    quizAccessModalEl.showModal();
  });
}

if (quizAccessCloseBtnEl) {
  quizAccessCloseBtnEl.addEventListener("click", () => {
    if (quizAccessModalEl.open) quizAccessModalEl.close();
  });
}

if (quizLoveBtnEl) {
  quizLoveBtnEl.addEventListener("click", () => {
    showEggSurpriseFromAccess();
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
  if (eggFlowActive) {
    eggFlowActive = false;
    primeBlessingWebAudio();
    showBlessingLinesThenMeteorRain();
  }
});

function initCanvasPanZoom() {
  const wrap = canvasWrapEl;
  const stage = canvasStageEl;
  if (!wrap || !stage) return;

  let scale = 1;
  let tx = 0;
  let ty = 0;
  /** 最小为 1：完整呈现主视图，不可再缩小 */
  const MIN_SCALE = 1;
  const MAX_SCALE = 5;
  /** 格子内容透明度：完整主图（最小缩放）约 3%，随放大线性增至最大缩放 100% */
  const GRID_BLEND_MIN = 0.03;
  const GRID_BLEND_MAX = 1;
  const PAN_THRESHOLD = 6;

  function clampPan() {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (!w || !h) return;
    const minTx = w - w * scale;
    const minTy = h - h * scale;
    tx = Math.min(0, Math.max(minTx, tx));
    ty = Math.min(0, Math.max(minTy, ty));
  }

  function applyCanvasView() {
    clampPan();
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale}) translateZ(0)`;
    const t = (scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE);
    const u = Math.min(1, Math.max(0, t));
    const gridBlend = GRID_BLEND_MIN + (GRID_BLEND_MAX - GRID_BLEND_MIN) * u;
    wrap.style.setProperty("--grid-blend", gridBlend.toFixed(4));
    if (scale <= MIN_SCALE + 1e-6) {
      wrap.dataset.canvasZoom = "fit";
    } else {
      wrap.dataset.canvasZoom = "in";
    }
  }

  function clampScale(s) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
  }

  function resetCanvasView() {
    scale = 1;
    tx = 0;
    ty = 0;
    skipClick = false;
    applyCanvasView();
  }

  let roRaf = null;
  const ro = new ResizeObserver(() => {
    if (roRaf != null) cancelAnimationFrame(roRaf);
    roRaf = requestAnimationFrame(() => {
      roRaf = null;
      applyCanvasView();
    });
  });
  ro.observe(wrap);

  let skipClick = false;
  /** idle | tracking（未超过阈值）| dragging（平移中） */
  let panState = "idle";
  let panStart = { x: 0, y: 0, tx: 0, ty: 0 };
  let activePointerId = null;
  /** iOS / 现代浏览器：触摸走 Pointer Events，双指捏合必须用指针坐标跟踪（仅靠 touch* 在 Safari 上常不触发） */
  const activePointers = new Map();
  let pinchActive = false;
  let pinchBaseDist = 0;
  let pinchBaseScale = 1;

  /** iPhone/iPad：Pointer 双指捏合经常不完整；Touch 事件 + 禁用 gesture 才是可靠路径 */
  let touchPinchActive = false;
  let touchPinchBaseDist = 0;
  let touchPinchBaseScale = 1;

  function pointerDist() {
    if (activePointers.size < 2) return 0;
    const pts = [...activePointers.values()];
    const a = pts[0];
    const b = pts[1];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function touchSpan(tl) {
    return Math.hypot(tl[0].clientX - tl[1].clientX, tl[0].clientY - tl[1].clientY);
  }

  function applyTouchPinch(tl) {
    const d = Math.max(touchSpan(tl), 1e-3);
    const newScale = clampScale(touchPinchBaseScale * (d / touchPinchBaseDist));
    const rect = wrap.getBoundingClientRect();
    const mx = (tl[0].clientX + tl[1].clientX) / 2 - rect.left;
    const my = (tl[0].clientY + tl[1].clientY) / 2 - rect.top;
    const wx = (mx - tx) / scale;
    const wy = (my - ty) / scale;
    tx = mx - wx * newScale;
    ty = my - wy * newScale;
    scale = newScale;
    if (scale <= MIN_SCALE + 1e-6) {
      tx = 0;
      ty = 0;
    }
    applyCanvasView();
  }

  /** Safari：系统 pinch 会缩放整页并抢走手势；在画区禁止默认 gesture，改由 Touch 捏合驱动 */
  if (typeof window.GestureEvent !== "undefined") {
    wrap.addEventListener(
      "gesturestart",
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );
    wrap.addEventListener(
      "gesturechange",
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );
    wrap.addEventListener(
      "gestureend",
      (e) => {
        e.preventDefault();
      },
      { passive: false }
    );
  }

  wrap.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length === 2) {
        touchPinchActive = true;
        pinchActive = false;
        activePointers.clear();
        touchPinchBaseDist = Math.max(touchSpan(e.touches), 1e-3);
        touchPinchBaseScale = scale;
        try {
          e.preventDefault();
        } catch {
          /* ignore */
        }
      }
    },
    { passive: false, capture: true }
  );

  wrap.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length < 2) {
        touchPinchActive = false;
        return;
      }
      if (!touchPinchActive) {
        touchPinchActive = true;
        pinchActive = false;
        activePointers.clear();
        touchPinchBaseDist = Math.max(touchSpan(e.touches), 1e-3);
        touchPinchBaseScale = scale;
      }
      try {
        e.preventDefault();
      } catch {
        /* ignore */
      }
      applyTouchPinch(e.touches);
    },
    { passive: false, capture: true }
  );

  function endTouchPinchIfNeeded(e) {
    if (e.touches.length < 2) touchPinchActive = false;
  }
  wrap.addEventListener("touchend", endTouchPinchIfNeeded, { capture: true });
  wrap.addEventListener("touchcancel", endTouchPinchIfNeeded, { capture: true });

  wrap.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let mult = 1;
      if (e.deltaMode === 1) {
        mult = Math.exp(-e.deltaY * 0.12);
      } else if (e.deltaMode === 2) {
        mult = e.deltaY < 0 ? 1.25 : 0.8;
      } else {
        mult = Math.exp(-e.deltaY * 0.0015);
      }
      const newScale = clampScale(scale * mult);
      const wx = (mx - tx) / scale;
      const wy = (my - ty) / scale;
      tx = mx - wx * newScale;
      ty = my - wy * newScale;
      scale = newScale;
      if (scale <= MIN_SCALE + 1e-6) {
        tx = 0;
        ty = 0;
      }
      applyCanvasView();
    },
    { passive: false }
  );

  wrap.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (touchPinchActive) return;
      skipClick = false;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 2) {
        const d = Math.max(pointerDist(), 1e-3);
        pinchBaseDist = d;
        pinchBaseScale = scale;
        pinchActive = true;
        if (activePointerId != null) {
          try {
            wrap.releasePointerCapture(activePointerId);
          } catch {
            /* ignore */
          }
        }
        panState = "idle";
        activePointerId = null;
        wrap.classList.remove("is-panning");
        try {
          e.preventDefault();
        } catch {
          /* ignore */
        }
        /** 双指落在格子上时，把两路指针抓到 wrap，避免移出格子后丢 move（尤其 WebKit） */
        for (const pid of activePointers.keys()) {
          try {
            wrap.setPointerCapture(pid);
          } catch {
            /* ignore */
          }
        }
        return;
      }

      if (scale <= MIN_SCALE + 1e-6) return;
      if (panState !== "idle") return;
      panState = "tracking";
      activePointerId = e.pointerId;
      panStart = { x: e.clientX, y: e.clientY, tx, ty };
    },
    { passive: false }
  );

  wrap.addEventListener(
    "pointermove",
    (e) => {
      if (touchPinchActive) return;
      if (activePointers.has(e.pointerId)) {
        activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      if (pinchActive && activePointers.size === 2) {
        try {
          e.preventDefault();
        } catch {
          /* ignore */
        }
        const d = Math.max(pointerDist(), 1e-3);
        const newScale = clampScale(pinchBaseScale * (d / pinchBaseDist));
        const rect = wrap.getBoundingClientRect();
        const pts = [...activePointers.values()];
        const mx = (pts[0].x + pts[1].x) / 2 - rect.left;
        const my = (pts[0].y + pts[1].y) / 2 - rect.top;
        const wx = (mx - tx) / scale;
        const wy = (my - ty) / scale;
        tx = mx - wx * newScale;
        ty = my - wy * newScale;
        scale = newScale;
        if (scale <= MIN_SCALE + 1e-6) {
          tx = 0;
          ty = 0;
        }
        applyCanvasView();
        return;
      }

      if (panState === "idle" || e.pointerId !== activePointerId) return;
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      if (panState === "tracking") {
        if (Math.abs(dx) <= PAN_THRESHOLD && Math.abs(dy) <= PAN_THRESHOLD) return;
        panState = "dragging";
        wrap.classList.add("is-panning");
        try {
          wrap.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (panState === "dragging") {
        tx = panStart.tx + dx;
        ty = panStart.ty + dy;
        applyCanvasView();
      }
    },
    { passive: false }
  );

  function endPan(e) {
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) {
      pinchActive = false;
      pinchBaseDist = 0;
    }

    if (e.pointerId !== activePointerId) return;
    const wasDragging = panState === "dragging";
    if (wasDragging) {
      try {
        wrap.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      skipClick = true;
    }
    panState = "idle";
    activePointerId = null;
    wrap.classList.remove("is-panning");
  }

  wrap.addEventListener("pointerup", endPan);
  wrap.addEventListener("pointercancel", endPan);
  wrap.addEventListener("pointerleave", (e) => {
    if (e.pointerType !== "mouse") return;
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinchActive = false;
  });

  wrap.addEventListener(
    "click",
    (e) => {
      if (!skipClick) return;
      if (!e.target.closest(".cell")) {
        skipClick = false;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      skipClick = false;
    },
    true
  );

  if (canvasResetBtnEl) {
    canvasResetBtnEl.addEventListener("click", (e) => {
      e.stopPropagation();
      resetCanvasView();
    });
  }

  applyCanvasView();
}

initCanvasPanZoom();
loadData();

/** 首帧后再挂一次自动进入定时，避免个别环境下首轮 setTimeout 与布局竞态；会清掉首轮并重新计 5 秒 */
requestAnimationFrame(() => {
  try {
    if (localStorage.getItem(CEREMONY_STORAGE_KEY) === "1") return;
  } catch {
    return;
  }
  scheduleBirthdayGateAutoEnter();
});
