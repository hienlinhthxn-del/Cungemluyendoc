@echo off
chcp 65001 > nul
title DAY CODE LEN MANG (AUTO)

echo =================================================
echo   KIEM TRA THAY DOI...
echo =================================================

:: Kiem tra xem co thay doi nao de commit khong (bao gom ca file moi)
set "has_changes="
for /f "delims=" %%a in ('git status --porcelain') do set has_changes=true

if defined has_changes (
    echo Phat hien co thay doi. Dang them vao commit...
    git add .
    
    :: Lay commit message tu tham so, hoac mac dinh
    set "commit_message=%~1"
    if not defined commit_message set "commit_message=Cap nhat tu dong"
    
    echo Dang commit voi message: "%commit_message%"
    git commit -m "%commit_message%"
    if %errorlevel% neq 0 (
        echo.
        echo LOI: Khong the commit. Vui long kiem tra lai.
        pause
        exit /b
    )
) else (
    echo Khong co thay doi nao de commit.
    echo Dang thu day code san co...
)

echo =================================================
echo   DANG DONG BO DU LIEU LEN GITHUB...
echo =================================================

git push origin main

if %errorlevel% neq 0 (
    echo.
    echo LOI: Khong the day code. Co the co thay doi moi tren server.
    echo Hay thu "git pull" hoac bam nut "Sync Changes" (Mau xanh) tren VS Code nhe!
) else (
    echo.
    echo THANH CONG! Code da len mang.
    echo Hay vao Render -> Manual Deploy nhe.
)
pause
