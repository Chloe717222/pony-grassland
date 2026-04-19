/**
 * 将 content 下祝福/判断题 CSV 统一为 gallery 表头，并全部保存为 UTF-8（无 BOM）。
 * 表头：编号,场景,文案,图片url,音频url,视频url,用户id
 *
 * - scene*-gallery.csv：由 GBK/UTF-8 读入后重写为 UTF-8
 * - scene*-interact.csv：补「场景」列，值为 1B…5B（与 gallery 的 1A…5A 区分）
 * - scene3-questions.csv：题目→文案，答案→图片url，解析→音频url；场景固定 3Q
 *
 * 用法：node scripts/unify-content-csv.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const contentDir = path.join(repoRoot, "content");

const CANONICAL_HEADER = [
  "编号",
  "场景",
  "文案",
  "图片url",
  "音频url",
  "视频url",
  "用户id",
];

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

function esc(v) {
  const s = String(v ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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

/** @param {Buffer} buf */
function decodeCsvText(buf) {
  const utf8 = buf.toString("utf8").replace(/^\uFEFF/, "");
  const first = utf8.split(/\r?\n/)[0] || "";
  if (/编号/.test(first) && (/文案/.test(first) || /题目/.test(first))) return utf8;
  try {
    return new TextDecoder("gbk").decode(buf).replace(/^\uFEFF/, "");
  } catch {
    return utf8;
  }
}

function writeBlessingCsvUtf8(outPath, rowsObjects) {
  const lines = [CANONICAL_HEADER.join(",")];
  for (const o of rowsObjects) {
    lines.push(
      CANONICAL_HEADER.map((k) => esc(o[k] ?? "")).join(",")
    );
  }
  fs.writeFileSync(outPath, lines.join("\r\n") + "\r\n", "utf8");
}

function parseBlessingRows(text) {
  text = String(text).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((ln) => ln.replace(/\s/g, "").length);
  if (lines.length < 2) return [];
  const headerParts = parseCSVLine(lines[0]);
  const col = resolveBlessingCsvColumns(headerParts);
  const out = [];
  for (let r = 1; r < lines.length; r++) {
    const parts = parseCSVLine(lines[r]);
    if (parts.length < 2) continue;
    const sceneCell =
      col.idxScene >= 0 ? csvCell(parts, col.idxScene) : "";
    out.push({
      编号: csvCell(parts, col.idxId),
      场景: sceneCell,
      文案: csvCell(parts, col.idxCopy),
      图片url: csvCell(parts, col.idxImg),
      音频url: csvCell(parts, col.idxAud),
      视频url: csvCell(parts, col.idxVid),
      用户id: col.idxUserId >= 0 ? csvCell(parts, col.idxUserId) : "",
    });
  }
  return out;
}

function main() {
  for (let sid = 1; sid <= 5; sid++) {
    const gPath = path.join(contentDir, `scene${sid}-gallery.csv`);
    const gBuf = fs.readFileSync(gPath);
    const gText = decodeCsvText(gBuf);
    const gRows = parseBlessingRows(gText);
    writeBlessingCsvUtf8(gPath, gRows);
    console.log("OK", path.relative(repoRoot, gPath), gRows.length, "rows");

    const iPath = path.join(contentDir, `scene${sid}-interact.csv`);
    const iBuf = fs.readFileSync(iPath);
    const iText = decodeCsvText(iBuf);
    const iRowsRaw = parseBlessingRows(iText);
    const interactSceneTag = `${sid}B`;
    const iRows = iRowsRaw.map((row) => ({
      ...row,
      场景: row.场景 && String(row.场景).trim() ? row.场景 : interactSceneTag,
    }));
    writeBlessingCsvUtf8(iPath, iRows);
    console.log("OK", path.relative(repoRoot, iPath), iRows.length, "rows");
  }

  const qPath = path.join(contentDir, "scene3-questions.csv");
  const qBuf = fs.readFileSync(qPath);
  const qText = decodeCsvText(qBuf);
  const lines = qText.split(/\r?\n/).filter((ln) => ln.replace(/\s/g, "").length);
  if (lines.length < 2) throw new Error("scene3-questions.csv 无数据行");
  const header = parseCSVLine(lines[0]);
  const norm = (h) =>
    String(h || "")
      .replace(/^\uFEFF/, "")
      .replace(/\s+/g, "");
  let idxId = 0;
  let idxTopic = 1;
  let idxAns = 2;
  let idxExp = 3;
  const isLegacy = header.some((h) => norm(h) === "题目");
  for (let h = 0; h < header.length; h++) {
    const k = norm(header[h]);
    if (k === "编号") idxId = h;
    if (isLegacy) {
      if (k === "题目") idxTopic = h;
      if (k === "答案") idxAns = h;
      if (k === "解析") idxExp = h;
    } else {
      if (k === "文案") idxTopic = h;
      if (k.toLowerCase() === "图片url") idxAns = h;
      if (k.toLowerCase() === "音频url") idxExp = h;
    }
  }
  const qOut = [];
  for (let r = 1; r < lines.length; r++) {
    const parts = parseCSVLine(lines[r]);
    const topic = csvCell(parts, idxTopic);
    if (!topic) continue;
    qOut.push({
      编号: csvCell(parts, idxId) || String(32000 + r),
      场景: "3Q",
      文案: topic,
      图片url: csvCell(parts, idxAns),
      音频url: csvCell(parts, idxExp),
      视频url: "",
      用户id: "",
    });
  }
  writeBlessingCsvUtf8(qPath, qOut);
  console.log("OK", path.relative(repoRoot, qPath), qOut.length, "rows");
}

try {
  main();
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
