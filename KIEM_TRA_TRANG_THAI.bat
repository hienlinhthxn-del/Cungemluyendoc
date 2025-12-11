@echo off
chcp 65001 > nul
title KIEM TRA TRANG THAI GITHUB
echo ========================================================
echo   DANG KIEM TRA XEM CODE DA DUOC DAY LEN CHUA
echo ========================================================
echo.

git status

echo.
echo ========================================================
echo   HUONG DAN DOC KET QUA:
echo   1. Neu thay dong: "Your branch is ahead of 'origin/main'..."
echo      => Code CHUA DUOC DAY LEN. Ban can chay lai file PUSH_FINAL.bat
echo.
echo   2. Neu thay dong: "Your branch is up to date with 'origin/main'"
echo      => Code DA LEN MANG THANH CONG. Loi nam o Render.
echo ========================================================
pause
