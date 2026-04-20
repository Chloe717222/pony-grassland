/**
 * 与 verify-site-assets.mjs 相同，但强制 SKIP_BLESSING_MEDIA_DISK_CHECK=1（祝福栅格媒体可不落在仓库磁盘）。
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const script = path.join(repoRoot, "scripts", "verify-site-assets.mjs");

const r = spawnSync(process.execPath, [script], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env, SKIP_BLESSING_MEDIA_DISK_CHECK: "1" },
});
process.exit(r.status === null ? 1 : r.status);
