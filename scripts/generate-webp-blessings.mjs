/**
 * 将 content/ 下 PNG/JPEG 批量转为同名 .webp（与源文件同目录），供祝福页预览加载。
 * 不处理 SVG/GIF；不进入 node_modules。
 *
 * 用法：npm run generate:webp
 * 强制覆盖已有 webp：npm run generate:webp -- --force
 *
 * 依赖：npm i（安装 sharp）。生成后需将 .webp 一并上传 COS（与 png/jpg 同路径规则）。
 *
 * 压缩策略（偏体积，便于弱网首包）：长边超 1920 先缩小再编码；WebP quality 约 76、effort 5。
 * 重转：npm run generate:webp -- --force
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const contentDir = path.join(repoRoot, "content");

const SKIP_DIR_NAMES = new Set(["node_modules", ".git"]);
const RASTER_EXT = /\.(png|jpe?g)$/i;

function walkFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const name = ent.name;
    if (name.startsWith(".")) continue;
    const full = path.join(dir, name);
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(name)) continue;
      walkFiles(full, out);
    } else if (ent.isFile() && RASTER_EXT.test(name) && !/\.webp$/i.test(name)) {
      out.push(full);
    }
  }
}

function parseArgs() {
  const force = process.argv.includes("--force");
  return { force };
}

async function convertOne(absIn, force) {
  const dir = path.dirname(absIn);
  const base = path.basename(absIn);
  const stem = base.replace(RASTER_EXT, "");
  const outAbs = path.join(dir, stem + ".webp");
  if (!force && fs.existsSync(outAbs)) {
    const stIn = fs.statSync(absIn);
    const stOut = fs.statSync(outAbs);
    if (stOut.mtimeMs >= stIn.mtimeMs) return "skip";
  }
  const maxSide = 1920;
  const meta = await sharp(absIn).metadata();
  let pipeline = sharp(absIn).rotate();
  if (meta.width && meta.height && (meta.width > maxSide || meta.height > maxSide)) {
    pipeline = pipeline.resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true });
  }
  await pipeline
    .webp({ quality: 76, effort: 5, smartSubsample: true, alphaQuality: 80 })
    .toFile(outAbs);
  return "ok";
}

async function main() {
  const { force } = parseArgs();
  const files = [];
  walkFiles(contentDir, files);
  if (!files.length) {
    console.log("未找到可转换的 PNG/JPEG（路径：" + path.relative(repoRoot, contentDir) + "）");
    return;
  }
  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (const abs of files.sort()) {
    const rel = path.relative(repoRoot, abs);
    try {
      const r = await convertOne(abs, force);
      if (r === "ok") {
        ok++;
        console.log("OK  " + rel);
      } else {
        skipped++;
        console.log("SKIP " + rel + "（已有较新 webp，加 --force 可重转）");
      }
    } catch (e) {
      failed++;
      console.error("FAIL " + rel + " — " + (e && e.message ? e.message : e));
    }
  }
  console.log(
    "\n完成：转换 " + ok + " 个，跳过 " + skipped + " 个，失败 " + failed + " 个。请提交 content/**/*.webp 并上传到与 PNG 相同规则的存储。"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
