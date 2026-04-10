const GRID_COLS = 40;
const GRID_ROWS = 25;
const TOTAL = GRID_COLS * GRID_ROWS;

const csvFileEl = document.getElementById("csvFile");
const imageFileEl = document.getElementById("imageFile");
const downloadDataBtnEl = document.getElementById("downloadDataBtn");
const statusEl = document.getElementById("adminStatus");
const heroImageEl = document.getElementById("heroImage");
const mosaicEl = document.getElementById("mosaic");

const state = {
  heroImage: "https://picsum.photos/seed/lianlian-hero/1200/1500",
  items: {},
};

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

function renderPreview() {
  heroImageEl.src = state.heroImage;
  mosaicEl.innerHTML = "";
  for (let i = 1; i <= TOTAL; i++) {
    const id = i.toString().padStart(4, "0");
    const cell = document.createElement("div");
    cell.className = "cell";
    if (state.items[id]) cell.classList.add("has-content");
    cell.title = `编号 ${id}`;
    mosaicEl.appendChild(cell);
  }
}

function importCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) {
    statusEl.textContent = "状态：CSV 读取失败";
    return;
  }

  const items = {};
  let ok = 0;
  let skip = 0;
  for (const row of rows) {
    const id = normalizeId(pickValue(row, ["id", "ID", "编号", "号码", "序号"]));
    if (!id) {
      skip += 1;
      continue;
    }
    const typeRaw = pickValue(row, ["type", "类型", "内容类型"]).toLowerCase();
    const mapType = {
      text: "text",
      image: "image",
      audio: "audio",
      video: "video",
      文案: "text",
      文字: "text",
      图片: "image",
      语音: "audio",
      音频: "audio",
      视频: "video",
    };
    items[id] = {
      type: mapType[typeRaw] || "text",
      title: pickValue(row, ["title", "标题"]),
      text: pickValue(row, ["text", "文案", "祝福", "祝福内容"]),
      url: pickValue(row, ["url", "链接", "资源链接", "媒体链接"]),
      thumbnail: pickValue(row, ["thumbnail", "封面", "缩略图"]),
    };
    ok += 1;
  }
  state.items = items;
  statusEl.textContent = `状态：CSV 导入成功 ${ok} 条，跳过 ${skip} 条`;
  renderPreview();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function downloadDataJson() {
  const payload = {
    version: 1,
    range: { min: 1, max: TOTAL, cols: GRID_COLS, rows: GRID_ROWS },
    heroImage: state.heroImage,
    items: state.items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.json";
  a.click();
  URL.revokeObjectURL(url);
  statusEl.textContent = "状态：已下载 data.json，请覆盖项目根目录后发布";
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
  statusEl.textContent = "状态：底图已更新";
  renderPreview();
});

downloadDataBtnEl.addEventListener("click", downloadDataJson);
renderPreview();
