@echo off
echo ========================================================
echo   DAY CODE LAN CUOI - KHONG DUNG VS CODE
echo ========================================================

:: 1. Don dep lock file
if exist .git\index.lock del /f /q .git\index.lock

:: 2. Them file
echo [1/3] Dang them file...
git add .

:: 3. Commit
echo [2/3] Dang dong goi...
git commit -m "Final Manual Push via Script v2.0 - %time%"

:: 4. Push
echo [3/3] Dang day len mang...
git push origin main

echo.
echo ========================================================
echo   DA CHAY XONG! 
echo   Neu khong bao loi do (fatal) thi la THANH CONG.
echo ========================================================
pause
