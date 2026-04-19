/**
 * 从 content/data.json 生成 content/data.embed.js，在 index.html 中先于主脚本同步加载。
 * 用于 file:// 无法 fetch 本地 JSON、或 HTTP 下 data.json 请求失败时，仍可用与 data.json 一致的正式数据。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "content", "data.json");
const outPath = path.join(repoRoot, "content", "data.embed.js");

function writeNull() {
  fs.writeFileSync(
    outPath,
    "// 无 content/data.json 时占位；执行 npm run build:data 后重新生成\nwindow.__GRASSLAND_DATA_JSON__=null;\n",
    "utf8"
  );
}

if (!fs.existsSync(dataPath)) {
  console.warn("[embed] 未找到 content/data.json，已写入占位 data.embed.js");
  writeNull();
  process.exit(0);
}

const raw = fs.readFileSync(dataPath, "utf8");
let obj;
try {
  obj = JSON.parse(raw);
} catch (e) {
  console.error("[embed] content/data.json 不是合法 JSON，跳过写入 data.embed.js", e && e.message);
  writeNull();
  process.exit(1);
}

if (!obj || typeof obj !== "object" || !Array.isArray(obj.gallery) || !obj.gallery.length) {
  console.warn("[embed] data.json 缺少有效 gallery，写入 null 占位");
  writeNull();
  process.exit(0);
}

const serialized = JSON.stringify(obj);
const out = `window.__GRASSLAND_DATA_JSON__=${serialized};\n`;
fs.writeFileSync(outPath, out, "utf8");
console.log("[embed] 已写入 content/data.embed.js（与 data.json 同源）");
