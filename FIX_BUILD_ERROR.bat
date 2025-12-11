@echo off
chcp 65001 > nul
title FIX BUILD ERROR
echo ========================================================
echo   ĐANG SỬA LỖI BUILD
echo ========================================================
echo.

echo 1. Đang thêm các file thay đổi...
git add .

echo 2. Đang lưu phiên bản mới (Commit)...
git commit -m "Fix typescript and config"

echo 3. Đang đẩy lên GitHub...
echo    (Nếu cửa sổ yêu cầu đăng nhập, hãy đăng nhập nhé)
echo.
git push origin main

echo.
echo ========================================================
echo   HOÀN TẤT! HÃY KIỂM TRA LẠI RENDER DASHBOARD
echo ========================================================
pause
