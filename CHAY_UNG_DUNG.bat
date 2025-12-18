@echo off
chcp 65001 >nul
title Cung Em Luyen Doc - Khoi Dong
color 0f

echo ==========================================================
echo   DANG KHOI DONG UNG DUNG "CUNG EM LUYEN DOC"
echo ==========================================================
echo.

echo [Buoc 1/3] Kiem tra va cai dat thu vien...
call npm install --no-audit --no-fund --loglevel=error
if %errorlevel% neq 0 (
    echo [LOI] Khong the cai dat thu vien. Vui long kiem tra lai.
    pause
    exit /b
)

echo.
echo [Buoc 2/3] Cap nhat giao dien moi nhat (Build)...
echo    (Vui long cho khoang 10-20 giay...)
call npm run build
if %errorlevel% neq 0 (
    echo [LOI] Build that bai.
    pause
    exit /b
)

echo.
echo [Buoc 3/3] Khoi dong Server...
echo    -> Ung dung se tu dong mo tren trinh duyet.
echo    -> Vui long KHONG tat cua so nay khi dang su dung.
echo.

REM Mo trinh duyet sau 3 giay
timeout /t 3 >nul
start http://localhost:10000

REM Chay server
call npm start
pause
