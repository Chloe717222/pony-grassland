import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const REQUIRED_ROOT = ["index.html", "cake.html"];
/** 与 index.html 中 BLESSINGS_CSV_CANDIDATES 顺序一致，至少须存在其一 */
const CSV_CANDIDATES = [
  "content/blessings-scene-aj.csv",
  "content/content-import001(1).csv",
];
const BGM_REL = "content/happy-birthday.mp3";
/** 常见误操作：把某条祝福语音复制成生日 BGM 文件名 */
const BGM_MUST_NOT_MATCH = "content/0001.mp3";

/** @param {string} abs */
function sha256File(abs) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(abs));
  return h.digest("hex");
}

/** @param {string} p */
function toRepoPath(p) {
  const s = String(p || "").trim();
  if (!s) return "";
  const n = s.replace(/^\.\//, "");
  return path.join(repoRoot, n);
}

const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const AUDIO_EXTS = [".mp3", ".webm", ".ogg", ".m4a"];
const VIDEO_EXTS = [".mp4", ".webm", ".mov"];

/** @param {string} ref */
function extsForRef(ref) {
  const lower = ref.toLowerCase();
  if (VIDEO_EXTS.some((e) => lower.endsWith(e))) return VIDEO_EXTS;
  if (AUDIO_EXTS.some((e) => lower.endsWith(e))) return AUDIO_EXTS;
  return IMAGE_EXTS;
}

/** CSV 里扩展名可能与磁盘不一致（如写 .png 实为 .jpg），按类型在同编号下试常见扩展名 */
/** @param {string} ref */
function resolveContentRef(ref) {
  const absExact = toRepoPath(ref);
  if (fs.existsSync(absExact)) return true;
  const stem = ref.replace(/\.[^./\\]+$/i, "");
  if (!stem || stem === ref) return false;
  for (const e of extsForRef(ref)) {
    if (fs.existsSync(toRepoPath(stem + e))) return true;
  }
  return false;
}

/** @param {string} line */
function extractContentRefs(line) {
  const out = new Set();
  const re = /\.\/content\/[^\s,"']+/g;
  let m;
  while ((m = re.exec(line))) {
    out.add(m[0]);
  }
  return [...out];
}

function main() {
  const errors = [];

  for (const name of REQUIRED_ROOT) {
    const abs = path.join(repoRoot, name);
    if (!fs.existsSync(abs)) errors.push(`缺少根目录文件：${name}`);
  }

  let csvRel = "";
  let csvAbs = "";
  for (const c of CSV_CANDIDATES) {
    const abs = path.join(repoRoot, c);
    if (fs.existsSync(abs)) {
      csvRel = c;
      csvAbs = abs;
      break;
    }
  }
  if (!csvAbs) {
    errors.push(`缺少祝福 CSV（以下均不存在）：${CSV_CANDIDATES.join("、")}`);
  }

  const bgmAbs = path.join(repoRoot, BGM_REL);
  if (!fs.existsSync(bgmAbs)) {
    errors.push(`缺少生日页 BGM：${BGM_REL}`);
  } else {
    const trapAbs = path.join(repoRoot, BGM_MUST_NOT_MATCH);
    if (fs.existsSync(trapAbs) && sha256File(bgmAbs) === sha256File(trapAbs)) {
      errors.push(
        `生日 BGM 与 ${BGM_MUST_NOT_MATCH} 内容完全相同（多为误复制）。请用真正的生日快乐音频覆盖 ${BGM_REL}。`
      );
    }
  }

  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }

  const csvText = fs.readFileSync(csvAbs, "utf8");
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    console.error("CSV 无数据行");
    process.exit(1);
  }

  const header = lines[0];
  if (!header.includes("编号") || !header.includes("图片url")) {
    console.error("CSV 表头应包含「编号」「图片url」等列");
    process.exit(1);
  }

  const missing = [];
  const seen = new Set();

  for (let i = 1; i < lines.length; i++) {
    const refs = extractContentRefs(lines[i]);
    for (const ref of refs) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      if (!resolveContentRef(ref)) missing.push({ line: i + 1, ref });
    }
  }

  if (missing.length) {
    console.error(`CSV 中引用但磁盘不存在的文件（共 ${missing.length} 处），示例：`);
    for (const m of missing.slice(0, 30)) {
      console.error(`  第 ${m.line} 行：${m.ref}`);
    }
    if (missing.length > 30) console.error(`  … 另有 ${missing.length - 30} 处`);
    process.exit(1);
  }

  console.log(
    `校验通过：${REQUIRED_ROOT.join("、")}、${csvRel}（${seen.size} 个不重复资源路径）、${BGM_REL} 均存在。`
  );
}

main();
