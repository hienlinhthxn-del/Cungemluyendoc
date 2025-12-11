@echo off
chcp 65001 > nul
title FIX LOI VITE CONFIG
echo ========================================================
echo   ĐANG SỬA LỖI CẤU HÌNH VITE
echo ========================================================
echo.

echo 1. Đang cap nhat file vite.config.ts...
git add vite.config.ts

echo 2. Luu va Day len GitHub...
git commit -m "Cleanup vite config for production"
git push origin main

echo.
echo ========================================================
echo   DA XONG! HAY VAO RENDER -> MANUAL DEPLOY
echo ========================================================
pause
