@echo off
chcp 65001 > nul
title XOA SACH CACH CU
echo ========================================================
echo   DANG DON DEP SACH SE GITHUB
echo ========================================================
echo.

echo 1. Xoa file cache...
git rm -r --cached .
git add .

echo 2. Luu phien ban sach se...
git commit -m "Clean refresh of all files"

echo 3. Day manh me len GitHub...
git push origin main --force

echo.
echo ========================================================
echo   DA XONG! HAY VAO RENDER -> MANUAL DEPLOY -> CLEAR CACHE
echo ========================================================
pause
