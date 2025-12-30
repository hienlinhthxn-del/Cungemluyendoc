@echo off
chcp 65001 > nul
title PUSH CODE FIX

echo =================================================
echo   DANG CONFIG GIT...
echo =================================================

:: Duong dan Git tuyet doi
set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"

echo Tim thay Git tai: %GIT_EXE%
echo.

echo =================================================
echo   DANG PUSH CODE...
echo =================================================

"%GIT_EXE%" add .
"%GIT_EXE%" commit -m "Fix teacher audio and missing scores"
"%GIT_EXE%" push origin main

if %errorlevel% neq 0 (
    echo.
    echo LOI: Khong the push code. Da co loi xay ra.
) else (
    echo.
    echo THANH CONG! Da day code len Render.
)
pause
