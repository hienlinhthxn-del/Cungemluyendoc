@echo off
title CUNG EM LUYEN DOC - PUBLIC MODE
echo ===================================================
echo   DANG KHOI DONG UNG DUNG VA TAO LIEN KET ONLINE
echo ===================================================
echo.

:: 1. Start the server in the background
echo [1/2] Dang chay server noi bo...
start /B node server/index.js > server_log.txt 2>&1

:: Wait a bit for server to start
timeout /t 3 /nobreak >nul

:: 2. Start localtunnel
echo [2/2] Dang ket noi ra Internet (Localtunnel)...
echo.
echo ---------------------------------------------------
echo  HAY COPPY LIEN KET BEN DUOI VA GUI CHO HOC SINH:
echo  (Luu y: Khi vao link lan dau, trang web se yeu cau
echo   nhap Mat khau Tunnel. Mat khau la IP public cua may nay.)
echo ---------------------------------------------------
echo.
echo Dang lay link... (Vui long doi)
call npx localtunnel --port 3001 --print-requests

pause
