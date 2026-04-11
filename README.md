# liulian-birthday-2026

刘恋生贺静态站点：根目录 `index.html` 为入口；GitHub Actions 见 `.github/workflows/deploy-github-pages.yml`。

发布前可在仓库根目录执行 `node scripts/verify-site-assets.mjs`，确认 `data.json` 中的 `./content/…` 等相对路径在磁盘上存在（CI 在打包上传 Pages 前会自动跑）。
