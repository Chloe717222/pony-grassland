import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const REQUIRED_ROOT = ["index.html", "cake.html"];
/**
 * 与 index.html 数据源一致：分关 gallery / interact CSV；旧仓库可仍保留 blessings-test-five-plates.csv。
 * CI 会扫描「磁盘上实际存在的」下列文件中的资源路径。
 */
const CSV_SCAN_CANDIDATES = [
  "content/scene1-gallery.csv",
  "content/scene2-gallery.csv",
  "content/scene3-gallery.csv",
  "content/scene4-gallery.csv",
  "content/scene5-gallery.csv",
  "content/scene1-interact.csv",
  "content/scene2-interact.csv",
  "content/scene3-interact.csv",
  "content/scene4-interact.csv",
  "content/scene5-interact.csv",
  "content/blessings-test-five-plates.csv",
];
const BGM_REL = "content/audio_happybirthday.aac";
/** 常见误操作：把某条祝福语音复制成生日 BGM 文件名（旧编号资源；不存在则跳过比对） */
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
const AUDIO_EXTS = [".aac", ".mp3", ".webm", ".ogg", ".m4a"];
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
function normalizeContentRef(ref) {
  return String(ref || "")
    .trim()
    .replace(/^\.\//, "");
}

/** @param {string} ref */
function resolveContentRef(ref) {
  const n = normalizeContentRef(ref);
  if (!n) return false;
  const absExact = toRepoPath(n);
  if (fs.existsSync(absExact)) return true;
  const stem = n.replace(/\.[^./\\]+$/i, "");
  if (!stem || stem === n) return false;
  for (const e of extsForRef(n)) {
    if (fs.existsSync(toRepoPath(stem + e))) return true;
  }
  return false;
}

/** @param {string} line */
function extractContentRefs(line) {
  const out = new Set();
  /** 与现网 CSV 一致：多为 content/xxx，旧数据可为 ./content/xxx */
  const re = /(?:\.\/)?content\/[^\s,"']+/g;
  let m;
  while ((m = re.exec(line))) {
    out.add(normalizeContentRef(m[0]));
  }
  return [...out];
}

function main() {
  const errors = [];

  for (const name of REQUIRED_ROOT) {
    const abs = path.join(repoRoot, name);
    if (!fs.existsSync(abs)) errors.push(`缺少根目录文件：${name}`);
  }

  const csvFilesToScan = [];
  for (const c of CSV_SCAN_CANDIDATES) {
    const abs = path.join(repoRoot, c);
    if (fs.existsSync(abs)) csvFilesToScan.push({ rel: c, abs });
  }
  if (!csvFilesToScan.length) {
    errors.push(`缺少祝福相关 CSV（以下均不存在）：${CSV_SCAN_CANDIDATES.join("、")}`);
  }

  const bgmAbs = path.join(repoRoot, BGM_REL);
  if (!fs.existsSync(bgmAbs)) {
    errors.push(`缺少生日页 BGM：${BGM_REL}`);
  } else {
    const trapAbs = path.join(repoRoot, BGM_MUST_NOT_MATCH);
    if (fs.existsSync(trapAbs) && sha256File(bgmAbs) === sha256File(trapAbs)) {
      /** 不阻断 CI：占位 BGM 仍允许发布；替换为独立音轨后本提示会消失 */
      console.warn(
        `[verify] 提示：${BGM_REL} 与 ${BGM_MUST_NOT_MATCH} 内容相同（多为误复制）。建议覆盖为独立生日快乐音频。`
      );
    }
  }

  if (errors.length) {
    for (const e of errors) console.error(e);
    process.exit(1);
  }

  const missing = [];
  const seen = new Set();
  let scannedFiles = 0;

  for (const { rel, abs } of csvFilesToScan) {
    const csvText = fs.readFileSync(abs, "utf8");
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      console.error(`${rel}：无数据行`);
      process.exit(1);
    }
    const header = lines[0];
    if (!header.includes("编号") || !header.includes("图片url")) {
      console.error(`${rel}：表头应包含「编号」「图片url」等列`);
      process.exit(1);
    }
    scannedFiles++;
    for (let i = 1; i < lines.length; i++) {
      const refs = extractContentRefs(lines[i]);
      for (const ref of refs) {
        if (seen.has(ref)) continue;
        seen.add(ref);
        if (!resolveContentRef(ref)) missing.push({ file: rel, line: i + 1, ref });
      }
    }
  }

  if (missing.length) {
    console.error(`CSV 中引用但磁盘不存在的文件（共 ${missing.length} 处），示例：`);
    for (const m of missing.slice(0, 30)) {
      console.error(`  ${m.file} 第 ${m.line} 行：${m.ref}`);
    }
    if (missing.length > 30) console.error(`  … 另有 ${missing.length - 30} 处`);
    process.exit(1);
  }

  console.log(
    `校验通过：${REQUIRED_ROOT.join("、")}；已扫描 ${scannedFiles} 个 CSV；${seen.size} 个不重复资源路径；${BGM_REL} 存在。`
  );
}

main();
