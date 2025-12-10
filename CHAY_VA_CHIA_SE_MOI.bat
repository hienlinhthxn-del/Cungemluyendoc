@echo off
chcp 65001 > nul
title Chạy Ứng Dụng - Phiên bản Cloudflare (Ổn định nhất)

echo ========================================================
echo   ĐANG KHỞI ĐỘNG ỨNG DỤNG (CÁCH 3 - CLOUDFLARE)
echo ========================================================
echo.

:: 1. Kiểm tra build
if not exist "dist" (
    echo    - Đang tạo bản build...
    call npm run build
)

echo.
echo 2. Đang kết nối Internet (Cloudflare)...
echo    Vui lòng chờ. Khi kết nối thành công, bạn sẽ thấy link trong cửa sổ mới.
echo    LƯU Ý: Nếu cửa sổ mới mở lên và tắt ngay, hãy báo lại cho tôi.
echo.

:: Chạy Cloudflare Tunnel
start "KET NOI CLOUDFLARE" cmd /k "timeout /t 5 >nul & echo DANG KET NOI... & npx -y cloudflared@latest tunnel --url http://127.0.0.1:3001"

echo.
echo 3. Đang chạy Server nội bộ...
echo    Dữ liệu sẽ được lưu tại máy tính này.
echo    QUAN TRỌNG: KHÔNG ĐƯỢC TẮT CỬA SỔ NÀY!
echo.

:: Chạy server chính trực tiếp bằng node (không qua npm để tránh lỗi)
cmd /k "node server/index.cjs"
