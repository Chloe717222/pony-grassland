/**
 * 从 content 下各关 CSV 生成 content/data.json（UTF-8），供 index.html 唯一数据源使用。
 * 用法：node scripts/csv-to-data-json.mjs
 * 监听：node scripts/csv-to-data-json.mjs --watch
 *
 * CSV 优先按 UTF-8 读取；若表头无法识别「编号」「文案」，则按 GBK 解码（兼容 Excel 默认 ANSI/GBK 另存）。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const contentDir = path.join(repoRoot, "content");
const manifestPath = path.join(contentDir, "blessings-manifest.json");
const outPath = path.join(contentDir, "data.json");

const SCENE_COUNT = 5;

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (c === '"') {
      if (inQ && i + 1 < line.length && line.charAt(i + 1) === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (c === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function csvCell(parts, idx) {
  if (idx < 0 || idx >= parts.length) return "";
  return String(parts[idx] == null ? "" : parts[idx]).trim();
}

function resolveBlessingCsvColumns(headerCells) {
  let idxId = -1;
  let idxCopy = -1;
  let idxImg = -1;
  let idxAud = -1;
  let idxVid = -1;
  let idxScene = -1;
  let idxUserId = -1;
  for (let h = 0; h < headerCells.length; h++) {
    const k = String(headerCells[h] || "")
      .replace(/^\uFEFF/, "")
      .replace(/\s+/g, "");
    if (k === "编号") idxId = h;
    else if (k === "文案") idxCopy = h;
    else if (k.toLowerCase() === "图片url") idxImg = h;
    else if (k.toLowerCase() === "音频url") idxAud = h;
    else if (k.toLowerCase() === "视频url") idxVid = h;
    else if (k === "场景") idxScene = h;
    else if (k === "用户id" || k.toLowerCase() === "userid") idxUserId = h;
  }
  if (idxId < 0) idxId = 0;
  if (idxCopy < 0) idxCopy = 1;
  if (idxImg < 0) idxImg = 2;
  if (idxAud < 0) idxAud = 3;
  if (idxVid < 0) idxVid = 4;
  return { idxId, idxCopy, idxImg, idxAud, idxVid, idxScene, idxUserId };
}

function normalizeAssetPath(s) {
  if (s == null || typeof s !== "string") return "";
  s = s.trim();
  if (s.indexOf("./") === 0) return s.slice(2);
  return s;
}

/** 有用户 id 但文案与四类媒体全空：占位行，不出现在祝福页 */
function isBlessingRowShellOnlyUserId(row) {
  const uid = row.userId != null ? String(row.userId).trim() : "";
  if (!uid) return false;
  const t = row.text != null ? String(row.text).trim() : "";
  const i = row.image != null ? String(row.image).trim() : "";
  const a = row.audio != null ? String(row.audio).trim() : "";
  const v = row.video != null ? String(row.video).trim() : "";
  return !t && !i && !a && !v;
}

function parseBlessingsCSV(text) {
  text = String(text).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((ln) => ln.replace(/\s/g, "").length);
  if (lines.length < 2) return [];
  const headerParts = parseCSVLine(lines[0]);
  const col = resolveBlessingCsvColumns(headerParts);
  const out = [];
  const usedIds = Object.create(null);
  for (let r = 1; r < lines.length; r++) {
    const parts = parseCSVLine(lines[r]);
    if (parts.length < 2) continue;
    let id = parseInt(csvCell(parts, col.idxId), 10);
    if (Number.isNaN(id)) id = 900000 + r;
    while (usedIds[String(id)]) id += 1;
    usedIds[String(id)] = true;
    const copy = csvCell(parts, col.idxCopy);
    const img = normalizeAssetPath(csvCell(parts, col.idxImg));
    const aud = normalizeAssetPath(csvCell(parts, col.idxAud));
    const vid = normalizeAssetPath(csvCell(parts, col.idxVid));
    let typ = "text";
    if (vid) typ = "video";
    else if (aud) typ = "audio";
    else if (img) typ = "image";
    const sceneCell = col.idxScene >= 0 ? csvCell(parts, col.idxScene) : "";
    const userIdCell = col.idxUserId >= 0 ? csvCell(parts, col.idxUserId) : "";
    const row = {
      id,
      type: typ,
      text: copy,
      image: img || "",
      audio: aud || "",
      video: vid || "",
      nickname: "",
      userId: userIdCell,
      scene: sceneCell,
    };
    if (isBlessingRowShellOnlyUserId(row)) continue;
    out.push(row);
  }
  return out;
}

/**
 * 用关卡号打标；若 CSV「场景」列已含子场景（如 1A、2B），必须保留，供祝福页按问题分组。
 */
function tagBlessingsWithScene(list, sid) {
  return list.map((n) => {
    const cell = n.scene != null ? String(n.scene).trim() : "";
    if (cell && /[A-Za-z]/.test(cell)) {
      return { ...n, scene: cell };
    }
    return { ...n, scene: sid };
  });
}

function parseScene3QuestionsCSV(text) {
  text = String(text).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((ln) => ln.replace(/\s/g, "").length);
  if (lines.length < 2) return [];
  const header = parseCSVLine(lines[0]);
  let idxId = 0;
  let idxText = 1;
  let idxAnswer = 2;
  let idxExplain = 3;
  let idxScene = -1;
  let legacy = false;
  for (let h = 0; h < header.length; h++) {
    const k = String(header[h] || "").replace(/^\uFEFF/, "").replace(/\s+/g, "");
    if (k === "题目") legacy = true;
  }
  for (let h = 0; h < header.length; h++) {
    const k = String(header[h] || "").replace(/^\uFEFF/, "").replace(/\s+/g, "");
    if (k === "编号") idxId = h;
    if (legacy) {
      if (k === "题目") idxText = h;
      else if (k === "答案") idxAnswer = h;
      else if (k === "解析") idxExplain = h;
    } else {
      if (k === "文案") idxText = h;
      else if (k.toLowerCase() === "图片url") idxAnswer = h;
      else if (k.toLowerCase() === "音频url") idxExplain = h;
      else if (k === "场景") idxScene = h;
    }
  }
  const out = [];
  for (let r = 1; r < lines.length; r++) {
    const parts = parseCSVLine(lines[r]);
    if (idxScene >= 0) {
      const sc = csvCell(parts, idxScene).trim();
      if (sc && sc !== "3Q") continue;
    }
    const textQ = csvCell(parts, idxText);
    if (!textQ) continue;
    const ansRaw = String(csvCell(parts, idxAnswer) || "")
      .trim()
      .toLowerCase();
    out.push({
      id: csvCell(parts, idxId) || String(32000 + r),
      text: textQ,
      answer: ansRaw === "true" || ansRaw === "1" || ansRaw === "yes" || ansRaw === "对",
      explanation: csvCell(parts, idxExplain) || "",
    });
  }
  return out;
}

/**
 * 第一关热点点击后弹层文案：编号(1-6 对应热点顺序)、名字、文案
 * 文件：content/scene1-enlighten-modal.csv（可选；缺失则 data.json 不含该字段，由页面内联默认兜底）
 */
function parseScene1EnlightenModalCsv(text) {
  text = String(text).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((ln) => ln.replace(/\s/g, "").length);
  if (lines.length < 2) return [];
  const header = parseCSVLine(lines[0]);
  let idxId = -1;
  let idxName = -1;
  let idxCopy = -1;
  for (let h = 0; h < header.length; h++) {
    const k = String(header[h] || "")
      .replace(/^\uFEFF/, "")
      .replace(/\s+/g, "");
    if (k === "编号") idxId = h;
    else if (k === "名字") idxName = h;
    else if (k === "文案") idxCopy = h;
  }
  if (idxName < 0) idxName = 1;
  if (idxCopy < 0) idxCopy = 2;
  if (idxId < 0) idxId = 0;
  const rows = [];
  for (let r = 1; r < lines.length; r++) {
    const parts = parseCSVLine(lines[r]);
    if (parts.length < 2) continue;
    const idRaw = csvCell(parts, idxId);
    const idNum = parseInt(idRaw, 10);
    const name = csvCell(parts, idxName);
    const copy = csvCell(parts, idxCopy);
    if (!copy) continue;
    rows.push({
      id: Number.isNaN(idNum) ? rows.length + 1 : idNum,
      name: name || "",
      text: copy,
    });
  }
  rows.sort((a, b) => a.id - b.id);
  return rows;
}

function parseScene5HolesCSV(text) {
  text = String(text).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((ln) => ln.replace(/\s/g, "").length);
  if (lines.length < 2) return [];
  const headerParts = parseCSVLine(lines[0]);
  const col = resolveBlessingCsvColumns(headerParts);
  let idxDur = -1;
  for (let hd = 0; hd < headerParts.length; hd++) {
    const hk = String(headerParts[hd] || "")
      .replace(/^\uFEFF/, "")
      .replace(/\s+/g, "");
    if (hk === "时长秒" || hk === "时长") idxDur = hd;
  }
  const usedIds = Object.create(null);
  const out = [];
  for (let r = 1; r < lines.length; r++) {
    const parts = parseCSVLine(lines[r]);
    if (parts.length < 2) continue;
    let id = parseInt(csvCell(parts, col.idxId), 10);
    if (Number.isNaN(id)) id = 510000 + r;
    while (usedIds[String(id)]) id += 1;
    usedIds[String(id)] = true;
    const copy = csvCell(parts, col.idxCopy);
    const img = normalizeAssetPath(csvCell(parts, col.idxImg));
    const aud = normalizeAssetPath(csvCell(parts, col.idxAud));
    const vid = normalizeAssetPath(csvCell(parts, col.idxVid));
    let typ = "text";
    if (vid) typ = "video";
    else if (aud) typ = "audio";
    else if (img) typ = "image";
    const sceneCell = col.idxScene >= 0 ? csvCell(parts, col.idxScene) : "";
    const userIdCell = col.idxUserId >= 0 ? csvCell(parts, col.idxUserId) : "";
    const durRaw = idxDur >= 0 ? csvCell(parts, idxDur) : "";
    const durNum = parseFloat(durRaw);
    const rowHole = {
      id,
      type: typ,
      text: copy,
      image: img || "",
      audio: aud || "",
      video: vid || "",
      nickname: "",
      userId: userIdCell,
      scene: sceneCell !== "" ? sceneCell : "E",
      durSec: Number.isNaN(durNum) || durNum < 0 ? 0 : durNum,
    };
    if (isBlessingRowShellOnlyUserId(rowHole)) continue;
    out.push(rowHole);
  }
  return out;
}

function countByScene(arr) {
  const m = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const row of arr) {
    const s = parseInt(row.scene, 10);
    if (!Number.isNaN(s) && s >= 1 && s <= 5) m[String(s)] += 1;
  }
  return m;
}

/** @param {Buffer} buf */
function decodeCsvText(buf) {
  const utf8 = buf.toString("utf8").replace(/^\uFEFF/, "");
  const first = utf8.split(/\r?\n/)[0] || "";
  // 祝福表：编号+文案；判断题：编号+题目（无「文案」列）
  if (/编号/.test(first) && (/文案/.test(first) || /题目/.test(first))) return utf8;
  try {
    return new TextDecoder("gbk").decode(buf).replace(/^\uFEFF/, "");
  } catch {
    return utf8;
  }
}

function readRequiredCsv(relPath) {
  const p = path.join(contentDir, relPath);
  if (!fs.existsSync(p)) {
    throw new Error(`缺少文件：${relPath}（完整路径：${p}）`);
  }
  return decodeCsvText(fs.readFileSync(p));
}

function readOptionalCsv(relPath) {
  const p = path.join(contentDir, relPath);
  if (!fs.existsSync(p)) return null;
  return decodeCsvText(fs.readFileSync(p));
}

function buildDataBundle() {
  let userManifest = {};
  if (fs.existsSync(manifestPath)) {
    userManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  }

  const gallery = [];
  const interact = [];

  for (let sid = 1; sid <= SCENE_COUNT; sid++) {
    const gText = readRequiredCsv(`scene${sid}-gallery.csv`);
    gallery.push(...tagBlessingsWithScene(parseBlessingsCSV(gText), sid));
    const iText = readRequiredCsv(`scene${sid}-interact.csv`);
    interact.push(...tagBlessingsWithScene(parseBlessingsCSV(iText), sid));
  }

  const qText = readRequiredCsv("scene3-questions.csv");
  const scene3Questions = parseScene3QuestionsCSV(qText);

  let scene1EnlightenModal = [];
  const enlightenPath = path.join(contentDir, "scene1-enlighten-modal.csv");
  if (fs.existsSync(enlightenPath)) {
    scene1EnlightenModal = parseScene1EnlightenModalCsv(decodeCsvText(fs.readFileSync(enlightenPath)));
  }

  const holesPath = path.join(contentDir, "scene5-holes.csv");
  if (fs.existsSync(holesPath)) {
    const holes = parseScene5HolesCSV(decodeCsvText(fs.readFileSync(holesPath)));
    for (const h of holes) {
      interact.push({ ...h, scene: 5 });
    }
  }

  const manifest = {
    version: userManifest.version || "csv-sync",
    galleryCounts: countByScene(gallery),
    interactCounts: countByScene(interact),
    scene3QuestionCount: scene3Questions.length,
  };

  return {
    version: manifest.version,
    generatedAt: new Date().toISOString(),
    manifest,
    gallery,
    interact,
    scene3Questions,
    scene1EnlightenModal,
  };
}

function writeDataEmbedCompanion() {
  const embedScript = path.join(__dirname, "write-data-embed.mjs");
  const r = spawnSync(process.execPath, [embedScript], { cwd: repoRoot, encoding: "utf8" });
  if (r.status !== 0) {
    console.warn("[write-data-embed]", (r.stderr || r.stdout || "").trim() || "失败");
  }
}

function writeDataJson() {
  const bundle = buildDataBundle();
  fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n", "utf8");
  console.log(
    `已写入 ${path.relative(repoRoot, outPath)}（gallery ${bundle.gallery.length} 条，interact ${bundle.interact.length} 条，判断题 ${bundle.scene3Questions.length} 条，第一关弹窗文案 ${bundle.scene1EnlightenModal.length} 条）`
  );
  writeDataEmbedCompanion();
}

const watchMode = process.argv.includes("--watch");

function main() {
  writeDataJson();
  if (!watchMode) return;

  let t = null;
  const debounceMs = 400;
  const watchDir = contentDir;
  console.log(`监听 ${path.relative(repoRoot, watchDir)} 下 .csv 变更，${debounceMs}ms 防抖后重建 data.json …`);

  fs.watch(watchDir, { persistent: true }, (_evt, filename) => {
    if (!filename || !String(filename).toLowerCase().endsWith(".csv")) return;
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      try {
        writeDataJson();
      } catch (e) {
        console.error("[csv-to-data-json]", e.message || e);
      }
    }, debounceMs);
  });
}

try {
  main();
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
