@echo off
echo ========================================================
echo   DANG CAP CUU GIT - FIX LOI KET (STUCK)...
echo ========================================================

:: 1. Xoa file khoa (lock file) neu co
if exist .git\index.lock (
    echo [INFO] Phat hien file lock, dang xoa...
    del /f /q .git\index.lock
)

:: 2. Them tat ca file
echo [INFO] Dang them file...
git add .

:: 3. Commit (bat chap loi cu)
echo [INFO] Dang dong goi code...
git commit -m "Cap cuu Git: Sua loi server va upload - %time%"

:: 4. Day hang len GitHub
echo [INFO] Dang day code len GitHub...
git push origin main

echo.
echo ========================================================
echo   DA XONG! HAY VAO RENDER KIEM TRA.
echo ========================================================
pause
