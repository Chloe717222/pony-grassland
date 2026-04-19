/**
 * Git pre-commit：暂存区若包含 content 目录下任意 .csv，则强制 npm run build:data 并把
 * content/data.json、content/data.embed.js 一并加入本次提交，避免「只改 CSV 未改 data」。
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function main() {
  let out = "";
  try {
    out = execSync("git diff --cached --name-only", { encoding: "utf8", cwd: repoRoot });
  } catch {
    process.exit(0);
  }
  const norm = (f) => f.replace(/\\/g, "/");
  const csvHit = out
    .split(/\r?\n/)
    .filter(Boolean)
    .some((f) => norm(f).startsWith("content/") && norm(f).toLowerCase().endsWith(".csv"));
  if (!csvHit) return;
  console.log("[pre-commit] 检测到 content 下 CSV 变更，正在执行 npm run build:data …");
  execSync("npm run build:data", { stdio: "inherit", cwd: repoRoot });
  execSync("git add content/data.json content/data.embed.js", { stdio: "inherit", cwd: repoRoot });
}

main();
