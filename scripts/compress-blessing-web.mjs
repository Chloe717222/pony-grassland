/**
 * 祝福页大 MP4：默认按「**体积优先**」重编码（小屏/弱网可接受再压）。
 * 源已是 H.264 时，若用高画质 + 高分辨率重转，**很容易比原片还大** —— 这是码控规律，不是 bug。
 *
 * 用法：
 *   node scripts/compress-blessing-web.mjs
 *   node scripts/compress-blessing-web.mjs --in content/zhufu2.mp4 --out content/zhufu2.web.mp4
 *   node scripts/compress-blessing-web.mjs --hq          # 更清晰、文件更大
 *   node scripts/compress-blessing-web.mjs --remux       # 不转码，只 +faststart，体积≈原片
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

var argv = process.argv.slice(2);
var inPath = "content/zhufu2.mp4";
var outPath = "content/zhufu2.web.mp4";
var remuxOnly = false;
var hq = false;
var maxW = 720;
var crf = 32;
var audioK = 96;
var vPreset = "slow";

for (var i = 0; i < argv.length; i++) {
  if (argv[i] === "--in" && argv[i + 1]) inPath = argv[++i];
  else if (argv[i] === "--out" && argv[i + 1]) outPath = argv[++i];
  else if (argv[i] === "--remux") remuxOnly = true;
  else if (argv[i] === "--hq") {
    hq = true;
    maxW = 960;
    crf = 28;
    audioK = 128;
  } else if (argv[i] === "--max" && argv[i + 1]) {
    var mw = parseInt(argv[++i], 10);
    if (mw > 0) maxW = mw;
  }
}

var inAbs = path.isAbsolute(inPath) ? inPath : path.join(repoRoot, inPath);
var outAbs = path.isAbsolute(outPath) ? outPath : path.join(repoRoot, outPath);

if (!fs.existsSync(inAbs)) {
  console.error("找不到输入文件: " + inAbs);
  process.exit(1);
}

var ff = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
if (ff.error || ff.status !== 0) {
  console.error("未检测到 ffmpeg。请安装后重试，或将 ffmpeg 加入 PATH。");
  process.exit(1);
}

var stIn0 = fs.statSync(inAbs);
var inMb = Math.round(stIn0.size / 1024 / 1024);
console.log("输入约 " + inMb + " MB");

var args;
if (remuxOnly) {
  console.log("模式：--remux（不重新编码，体积≈与输入相同，只把 moov 移到前面，利于边下边播）\n");
  args = ["-y", "-i", inAbs, "-c", "copy", "-movflags", "+faststart", outAbs];
} else {
  console.log(
    "模式：重编码 最大宽" +
      maxW +
      " 只缩不放 CRF" +
      crf +
      " AAC" +
      audioK +
      "k preset=" +
      vPreset +
      (hq ? "（--hq 更清晰、更大）" : "（默认可明显小于原片，画质弱网可接受）") +
      "\n"
  );
  var vf =
    "scale=" +
    maxW +
    ":-2:force_original_aspect_ratio=decrease,format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2";
  args = [
    "-y",
    "-i",
    inAbs,
    "-c:v",
    "libx264",
    "-crf",
    String(crf),
    "-preset",
    vPreset,
    "-c:a",
    "aac",
    "-b:a",
    audioK + "k",
    "-movflags",
    "+faststart",
    "-vf",
    vf,
    outAbs,
  ];
}

console.log("执行 ffmpeg …\n");
var run = spawnSync("ffmpeg", args, { stdio: "inherit" });
if (run.error) {
  console.error(run.error);
  process.exit(1);
}
if (run.status !== 0) {
  process.exit(run.status || 1);
}

var st = fs.statSync(outAbs);
var outMb = Math.round(st.size / 1024 / 1024);
var ratio = stIn0.size > 0 ? (100 * st.size) / stIn0.size : 100;
console.log("\n完成: " + outAbs);
console.log("约 " + outMb + " MB（相对输入 " + (ratio < 100 ? "减小 " + (100 - ratio).toFixed(0) : "增大 " + (ratio - 100).toFixed(0)) + "%）\n");
if (!remuxOnly && st.size > stIn0.size) {
  console.warn(
    "注意：重编码后仍比原片大时，说明原片已很省码率；要更小可试：\n" +
      "  node scripts/compress-blessing-web.mjs --max 540\n" +
      "  或把本脚本里默认 crf 改 32→34、maxW 再降。\n" +
      "  若只是网页起播慢、不要求变小：  node scripts/compress-blessing-web.mjs --remux\n"
  );
}
console.log("上线请同步 CSV/数据、上传 COS。");
