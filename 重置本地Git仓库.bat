@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === 重置本地 Git（删除 .git 后重新 init）===
echo 请先完全退出：Cursor、GitHub Desktop、VS Code，再按任意键继续。
echo.
pause

attrib -r -s -h ".git\*" /s /d 2>nul
rmdir /s /q ".git" 2>nul

if exist ".git" (
  echo.
  echo [失败] 仍无法删除 .git 文件夹，可能被占用。
  echo 请重启电脑后只运行本脚本，或把项目复制到新文件夹（不要复制 .git）再 git init。
  echo.
  pause
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo 未找到 git，请先安装 Git for Windows。
  pause
  exit /b 1
)

git init -b main
git add -A
git commit -m "Initial commit"

echo.
echo === 本地已完成 ===
echo 接下来在 GitHub 网页上：
echo   1. 删除旧仓库 liulian-birthday-2026（Settings 最底下 Danger zone）
echo   2. 新建同名空仓库（不要勾选 README）
echo 然后在本文件夹打开 cmd，执行：
echo   git remote add origin https://github.com/Chloe717222/liulian-birthday-2026.git
echo   git push -u origin main
echo.
pause
