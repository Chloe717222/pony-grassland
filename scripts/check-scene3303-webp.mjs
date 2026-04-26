/**
 * 校验 scene3-gallery.csv 中「场景 3303」的图片列是否能在 content/ 找到对应文件。
 * 用法：node scripts/check-scene3303-webp.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const csvPath = path.join(repoRoot, "content", "scene3-gallery.csv");
const contentDir = path.join(repoRoot, "content");

function parseCsvLine(line) {
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

const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
const rows = text.split(/\r?\n/).filter((l) => l.replace(/\s/g, "").length);
const header = parseCsvLine(rows[0]);
const idxScene = header.findIndex((h) => String(h || "").replace(/\s/g, "") === "场景");
const idxImage = header.findIndex((h) => /图片|image/i.test(String(h || "")));

if (idxScene < 0 || idxImage < 0) {
  console.error("未找到「场景」「图片」列，表头：", header);
  process.exit(1);
}

const missing = [];
const emptyImage = [];
let count3303 = 0;

for (let r = 1; r < rows.length; r++) {
  const fields = parseCsvLine(rows[r]);
  const scene = String(fields[idxScene] || "").trim();
  if (scene !== "3303") continue;
  count3303++;
  const img = String(fields[idxImage] || "").trim();
  if (!img) {
    emptyImage.push({ row: r + 1, id: fields[0] });
    continue;
  }
  if (/^https?:\/\//i.test(img)) {
    console.log("外链跳过:", img.slice(0, 80));
    continue;
  }
  const rel = img.replace(/^\.\//, "");
  const abs = path.join(repoRoot, rel.split("/").join(path.sep));
  if (!fs.existsSync(abs)) {
    missing.push({ row: r + 1, id: fields[0], path: rel });
  }
}

console.log("场景 3303 行数:", count3303);
console.log("图片列为空的行（可能为纯文案）:", emptyImage.length);
if (emptyImage.length) console.log(emptyImage.slice(0, 15));
console.log("CSV 已写路径但本地 content 缺文件:", missing.length);
if (missing.length) {
  console.log(missing.slice(0, 30));
  if (missing.length > 30) console.log("… 共 " + missing.length + " 条");
  process.exitCode = 1;
} else {
  console.log("OK：3303 引用的相对路径在本地 content 均存在（空图行除外）。");
}
