@echo off
chcp 65001 > nul
title DAY CODE LEN MANG (AUTO)
echo =================================================
echo   DANG DONG BO DU LIEU...
echo =================================================

git push origin main

if %errorlevel% neq 0 (
    echo.
    echo LOI: Khong the day code.
    echo Ban hay thu bam nut "Sync Changes" (Mau xanh) tren VS Code nhe!
) else (
    echo.
    echo THANH CONG! Code da len mang.
    echo Hay vao Render -> Manual Deploy nhe.
)
pause
