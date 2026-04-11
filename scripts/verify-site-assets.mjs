/**
 * 部署前自检：data.json 里引用的相对路径文件是否在仓库中存在。
 * 运行：node scripts/verify-site-assets.mjs
 * 用于 GitHub Actions 或本地发布前，避免「线上 JSON 写了路径但仓库里没有该文件」。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataPath = path.join(root, "data.json");

const REL = /^\.\//;
const HTTP = /^https?:\/\//i;
const DATA = /^data:/i;

function shouldCheckMediaRef(s) {
  const u = String(s || "").trim();
  if (!u) return false;
  if (DATA.test(u) || HTTP.test(u) || u.startsWith("blob:")) return false;
  if (REL.test(u) || (!HTTP.test(u) && !path.isAbsolute(u))) return true;
  return false;
}

function resolveSitePath(ref) {
  const u = String(ref || "").trim();
  if (REL.test(u)) return path.join(root, u.slice(2));
  if (!HTTP.test(u) && !path.isAbsolute(u)) return path.join(root, u);
  return null;
}

function collectPathsFromItem(item) {
  const keys = ["imageUrl", "thumbnail", "url", "audioUrl", "videoUrl"];
  const out = [];
  if (!item || typeof item !== "object") return out;
  for (const k of keys) {
    if (shouldCheckMediaRef(item[k])) out.push(String(item[k]).trim());
  }
  return out;
}

function main() {
  const errors = [];
  const mismatchExamples = [];
  let mismatchCount = 0;
  const seen = new Set();

  const requiredRootFiles = ["index.html", "app.js", "styles.css", "data.json"];
  for (const f of requiredRootFiles) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) errors.push(`缺少站点根文件：${f}`);
  }

  if (!fs.existsSync(dataPath)) {
    console.error("未找到 data.json");
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch (e) {
    console.error("data.json 解析失败:", e.message);
    process.exit(1);
  }

  const hero = data.heroImage;
  if (typeof hero === "string" && shouldCheckMediaRef(hero)) {
    const hp = resolveSitePath(hero);
    if (hp && !fs.existsSync(hp)) errors.push(`主视觉 heroImage 指向的文件不存在：${hero}`);
  }

  const items = data.items && typeof data.items === "object" ? data.items : {};
  for (const [id, item] of Object.entries(items)) {
    for (const ref of collectPathsFromItem(item)) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      const abs = resolveSitePath(ref);
      if (!abs) continue;
      if (fs.existsSync(abs)) continue;

      const m = /^\.\/content\/(\d{4})\.([a-z0-9]+)$/i.exec(ref);
      if (m) {
        const idPart = m[1];
        const dir = path.join(root, "content");
        let alt = null;
        if (fs.existsSync(dir)) {
          const candidates = fs
            .readdirSync(dir)
            .filter((f) => new RegExp(`^${idPart}\\.`, "i").test(f));
          if (candidates.length) alt = candidates.join(", ");
        }
        if (alt) {
          mismatchCount += 1;
          if (mismatchExamples.length < 5) mismatchExamples.push({ id, ref, alt });
        } else {
          errors.push(`格子 ${id}：引用的文件不存在：${ref}（content/ 下也无同编号文件）`);
        }
      } else {
        errors.push(`格子 ${id}：引用的文件不存在：${ref}`);
      }
    }
  }

  const contentDir = path.join(root, "content");
  if (!fs.existsSync(contentDir)) {
    errors.push("缺少 content/ 目录（图片/音视频应与此目录一起部署）");
  }

  if (errors.length) {
    console.error("校验失败（共 " + errors.length + " 条）：");
    for (const e of errors) console.error("  -", e);
    process.exit(1);
  }

  if (mismatchCount > 0) {
    console.log(
      `[提示] 共 ${mismatchCount} 处 JSON 中的 ./content/编号.扩展名 与磁盘实际扩展名不一致（页面会按扩展名链式重试加载，仍建议对齐）。示例：`
    );
    for (const ex of mismatchExamples) {
      console.log(`  - 格子 ${ex.id}：JSON 为 ${ex.ref}，磁盘同编号有：${ex.alt}`);
    }
    console.log("  可运行：node scripts/rewrite-data-to-content-urls.mjs 按磁盘文件改写 data.json。");
  }

  console.log("校验通过：根目录入口文件、data.json 相对路径与 content/ 一致。");
}

main();
