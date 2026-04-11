/**
 * 从 content/ 下四位编号原图批量生成 content/<子目录>/{id}.webp（默认子目录 thumbs512、长边 512）。
 * 与 app.js 中 CONTENT_THUMB_SUBDIR 一致；弹窗仍用原图 imageUrl。
 *
 * 用法（在仓库根或 scripts 目录均可）：
 *   cd scripts && npm install && node generate-content-thumbs.mjs ../content
 *   node generate-content-thumbs.mjs ./content 384 --out=thumbs   # 更小、写到 content/thumbs/
 *   node generate-content-thumbs.mjs ./content 512 --force       # 同目录覆盖（部分环境可能 EPERM，可改 --out=thumbs512_new）
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const ID_RE = /^(\d{4})\.(jpe?g|png|webp|gif|bmp)$/i;

function parseThumbOutSubdir(argv) {
  const raw = argv.find((a) => a.startsWith("--out="));
  let s = raw ? String(raw.slice(6)).trim() : "thumbs512";
  if (!/^[a-zA-Z0-9_-]{1,48}$/.test(s)) {
    console.error("--out= 仅允许字母数字下划线连字符，例如 --out=thumbs512");
    process.exit(1);
  }
  return s;
}

async function main() {
  const all = process.argv.slice(2);
  const force = all.includes("--force");
  const outSub = parseThumbOutSubdir(all);
  const argvPos = all.filter((a) => a !== "--force" && !a.startsWith("--out="));
  const contentDir = path.resolve(argvPos[0] || "content");
  const numArg = argvPos.find((a) => /^\d+$/.test(a));
  const maxSide = Math.min(2048, Math.max(64, Number(numArg) || 512));

  if (!fs.existsSync(contentDir) || !fs.statSync(contentDir).isDirectory()) {
    console.error(
      "用法: node generate-content-thumbs.mjs <content 目录路径> [长边像素，默认512] [--force] [--out=thumbs]"
    );
    process.exit(1);
  }

  const outDir = path.join(contentDir, outSub);
  fs.mkdirSync(outDir, { recursive: true });

  const names = fs.readdirSync(contentDir, { withFileTypes: true });
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const ent of names) {
    if (!ent.isFile()) continue;
    const m = ID_RE.exec(ent.name);
    if (!m) continue;
    const id = m[1];
    const src = path.join(contentDir, ent.name);
    const dest = path.join(outDir, `${id}.webp`);
    if (!force && fs.existsSync(dest)) {
      skip += 1;
      continue;
    }
    if (force && fs.existsSync(dest)) {
      try {
        fs.unlinkSync(dest);
      } catch {
        /* 仍尝试覆盖写入 */
      }
    }
    try {
      await sharp(src)
        .rotate()
        .resize({
          width: maxSide,
          height: maxSide,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toFile(dest);
      ok += 1;
      if (ok % 100 === 0) console.error(`…已写 ${ok} 张`);
    } catch (e) {
      fail += 1;
      console.error(`${id}: ${e && e.message ? e.message : e}`);
    }
  }

  console.error(
    `完成：新生成 ${ok}，跳过已存在 ${skip}，失败 ${fail}。输出目录: ${outDir}（子目录「${outSub}」；请与 app.js 中 CONTENT_THUMB_SUBDIR 一致）`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
