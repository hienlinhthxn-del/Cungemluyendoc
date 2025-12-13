@echo off
echo ========================================================
echo   FORCE UPDATING PROJECT TO GITHUB & RENDER
echo ========================================================

:: 1. Add all files
git add .

:: 2. Commit with a timestamp to ensure it's a new change
git commit -m "Force Update: Add Debug Route and Fix Config - %time%"

:: 3. Push to origin (main branch)
git push origin main

echo.
echo ========================================================
echo   CODE PUSHED SUCCESSFULLY!
echo   Please go to Render Dashboard and check the deployment.
echo ========================================================
pause
