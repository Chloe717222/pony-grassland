/**
 * 校验 content/data.json 中 gallery 每条 image/audio/video 在仓库磁盘中是否存在
 *（与 verify-site-assets.mjs 的 resolve 规则一致：同 stem 可换扩展名）。
 * 不依赖 BGM。输出按第 1–5 关分组。
 *
 * 用法: node scripts/verify-data-json-media.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dataPath = path.join(repoRoot, "content", "data.json");

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".heic", ".heif"];
const AUDIO_EXTS = [".aac", ".mp3", ".webm", ".ogg", ".m4a"];
const VIDEO_EXTS = [".mp4", ".webm", ".mov"];

function toRepoPath(p) {
  const s = String(p || "").trim();
  if (!s) return "";
  const n = s.replace(/^\.\//, "");
  return path.join(repoRoot, n);
}

function extsForRef(ref) {
  const lower = ref.toLowerCase();
  if (VIDEO_EXTS.some((e) => lower.endsWith(e))) return VIDEO_EXTS;
  if (AUDIO_EXTS.some((e) => lower.endsWith(e))) return AUDIO_EXTS;
  return IMAGE_EXTS;
}

function normalizeContentRef(ref) {
  return String(ref || "")
    .trim()
    .replace(/^\.\//, "");
}

function resolveContentRef(ref) {
  const n = normalizeContentRef(ref);
  if (!n) return false;
  if (/^https?:\/\//i.test(n)) return true;
  const absExact = toRepoPath(n);
  if (fs.existsSync(absExact)) return true;
  const stem = n.replace(/\.[^./\\]+$/i, "");
  if (!stem || stem === n) return false;
  for (const e of extsForRef(n)) {
    if (fs.existsSync(toRepoPath(stem + e))) return true;
  }
  return false;
}

/** 与 index 常见 11xx/22xx/…/55xx 题号一致：首数字即关（1–5） */
function majorSceneFromEntry(item) {
  const s = String(item.scene != null ? item.scene : "").trim();
  if (/^\d{4}$/.test(s)) {
    const d0 = parseInt(s[0], 10);
    if (d0 >= 1 && d0 <= 5) return d0;
  }
  const n = parseInt(s, 10);
  if (!isNaN(n) && n >= 1 && n <= 5) return n;
  return 1;
}

function main() {
  if (!fs.existsSync(dataPath)) {
    console.error("缺少 " + dataPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(dataPath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error("data.json 无法解析", e);
    process.exit(1);
  }
  const gallery = Array.isArray(data.gallery) ? data.gallery : [];
  const byScene = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  const fields = ["image", "audio", "video"];
  const missingGlobal = [];
  for (const item of gallery) {
    const sid = majorSceneFromEntry(item);
    const id = item.id != null ? item.id : "?";
    for (const f of fields) {
      const v = item[f];
      if (v == null || String(v).trim() === "") continue;
      const s = String(v).trim();
      if (/^https?:\/\//i.test(s)) continue;
      if (!resolveContentRef(s)) {
        const row = { id, field: f, ref: normalizeContentRef(s) };
        byScene[sid].push(row);
        missingGlobal.push({ scene: sid, ...row });
      }
    }
  }
  const sceneLabels = ["", "第一站", "第二站", "第三站", "第四站", "第五站"];
  let total = 0;
  for (let s = 1; s <= 5; s++) {
    const arr = byScene[s];
    if (!arr.length) {
      console.log(`【关 ${s} ${sceneLabels[s] || ""}】无缺失引用（或仅有 http(s) 外链）`);
      continue;
    }
    total += arr.length;
    console.log(`\n【关 ${s} ${sceneLabels[s] || ""}】缺失 ${arr.length} 处（id + 字段 + 路径）`);
    for (const r of arr) {
      console.log(`  id=${r.id}  ${r.field}: ${r.ref}`);
    }
  }
  console.log(`\n----\n共 ${missingGlobal.length} 条本地路径在磁盘中无对应文件（已按同 stem 换扩展名试过后仍缺）。`);
  if (missingGlobal.length) {
    const uniq = new Set(missingGlobal.map((m) => m.ref));
    console.log(`不重复路径约 ${uniq.size} 个。`);
  }

  const heicByScene = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of gallery) {
    const sid = majorSceneFromEntry(item);
    for (const f of fields) {
      const v = item[f];
      if (v == null || String(v).trim() === "") continue;
      const s = String(v).trim();
      if (/^https?:\/\//i.test(s)) continue;
      if (/\.hei[cf]$/i.test(s) && resolveContentRef(s)) heicByScene[sid]++;
    }
  }
  const heicTotal = Object.values(heicByScene).reduce((a, b) => a + b, 0);
  if (heicTotal) {
    console.log(
      `\n提示：以下关内存在已落盘的 HEIC/HEIF 配图（多数浏览器不能直接显示，index 会依次试 .jpg/.jpeg/.png/.webp，缺则控制台会出现多条 file 失败，非「少文件」而是缺副片）：`
    );
    for (let s = 1; s <= 5; s++) {
      if (heicByScene[s]) console.log(`  关 ${s}：${heicByScene[s]} 条`);
    }
  }

  process.exit(missingGlobal.length ? 1 : 0);
}

main();
