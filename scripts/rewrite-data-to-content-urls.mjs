/**
 * 将 data.json 中格子的 url 统一改为内链 ./content/{四位编号}.{扩展名}
 * 若 content/ 下已有对应编号文件，会按优先级选用实际扩展名；否则用默认（图 jpg / 音 mp3 / 视 mp4）。
 * 运行：node scripts/rewrite-data-to-content-urls.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTENT_MEDIA_DIR,
  CONTENT_IMAGE_EXTS,
  CONTENT_AUDIO_EXTS,
  CONTENT_VIDEO_EXTS,
  contentUrlFor,
  pickExtFromDisk,
} from "./content-media-exts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataPath = path.join(root, "data.json");

const raw = fs.readFileSync(dataPath, "utf8");
const data = JSON.parse(raw);
if (!data.items || typeof data.items !== "object") {
  console.error("data.json 缺少 items");
  process.exit(1);
}

const contentDir = path.join(root, CONTENT_MEDIA_DIR.replace(/^\.\//, ""));
const extsById = new Map();
if (fs.existsSync(contentDir)) {
  for (const f of fs.readdirSync(contentDir)) {
    const m = /^(\d{4})\.([a-z0-9]+)$/i.exec(f);
    if (!m) continue;
    const fileId = m[1];
    const ext = m[2].toLowerCase();
    if (!extsById.has(fileId)) extsById.set(fileId, []);
    extsById.get(fileId).push(ext);
  }
}

/** 格子配图内链：需与 content/ 下实际扩展名对齐（旧逻辑曾跳过「已是 ./content/… 的 text」导致 JSON 写 .jpg 磁盘只有 .png） */
const CONTENT_ITEM_URL = /^\.\/content\/\d{4}\.[a-z0-9]+$/i;

let n = 0;
for (const [id, item] of Object.entries(data.items)) {
  if (!item || typeof item !== "object") continue;
  const t = String(item.type || "text").toLowerCase();
  const disk = extsById.get(id) || [];
  let next = null;
  if (t === "text") {
    const u = String(item.url || "").trim();
    if (!u || /^https?:\/\//i.test(u)) {
      const ext = pickExtFromDisk(CONTENT_IMAGE_EXTS, disk);
      next = contentUrlFor(id, ext);
    } else if (CONTENT_ITEM_URL.test(u)) {
      const ext = pickExtFromDisk(CONTENT_IMAGE_EXTS, disk);
      next = contentUrlFor(id, ext);
    }
  } else if (t === "image") {
    const ext = pickExtFromDisk(CONTENT_IMAGE_EXTS, disk);
    next = contentUrlFor(id, ext);
  } else if (t === "audio") {
    const ext = pickExtFromDisk(CONTENT_AUDIO_EXTS, disk);
    next = contentUrlFor(id, ext);
  } else if (t === "video") {
    const ext = pickExtFromDisk(CONTENT_VIDEO_EXTS, disk);
    next = contentUrlFor(id, ext);
  }
  if (next != null && item.url !== next) {
    item.url = next;
    n += 1;
  }
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`已更新 ${n} 条 url → ./content/…（共 ${Object.keys(data.items).length} 条）`);
