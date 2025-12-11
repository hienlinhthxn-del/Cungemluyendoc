@echo off
chcp 65001 > nul
title CHUYEN DOI SANG JAVASCRIPT
echo ========================================================
echo   DA KHAC PHUC LOI TRUNG LAP KHOA
echo ========================================================
echo.

echo 1. Dang xoa file cau hinh cu (TS)...
git rm vite.config.ts --ignore-unmatch

echo 2. Dang them file cau hinh moi (JS)...
git add vite.config.js

echo 3. Luu va Day len GitHub...
git commit -m "Switch to vite.config.js to fix duplicate key error"
git push origin main

echo.
echo ========================================================
echo   DA XONG! HAY VAO RENDER -> MANUAL DEPLOY
echo ========================================================
pause
