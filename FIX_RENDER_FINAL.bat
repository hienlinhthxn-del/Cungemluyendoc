@echo off
chcp 65001 > nul
title FIX LOI RENDER CUOI CUNG
echo ========================================================
echo   ĐANG CẬP NHẬT CẤU HÌNH NODEJS CHO RENDER
echo ========================================================
echo.

echo 1. Đang them file cau hinh Node 20...
git add .nvmrc
git add .node-version

echo 2. Đang xoa file khoa phien ban cu (tranh xung dot)...
git add package-lock.json

echo 3. Luu va Day len GitHub...
git commit -m "Force Node 20 and remove lockfile"
git push origin main

echo.
echo ========================================================
echo   DA XONG! HAY VAO RENDER -> MANUAL DEPLOY -> CLEAR CACHE
echo ========================================================
pause
