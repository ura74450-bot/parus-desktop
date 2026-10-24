@echo off
chcp 65001 >nul
echo === Parus: local build (needs Node.js 18+) ===
call npm install || goto :fail
call npx electron-builder --win --x64 --ia32 --publish never || goto :fail
where makensis >nul 2>nul
if %errorlevel%==0 (
  makensis /V2 installer.nsi
) else if exist "C:\Program Files (x86)\NSIS\makensis.exe" (
  "C:\Program Files (x86)\NSIS\makensis.exe" /V2 installer.nsi
) else (
  echo NSIS not found - only separate installers were built: dist\Parus-Setup-x64.exe and dist\Parus-Setup-ia32.exe
)
echo Done. See the "dist" folder.
pause
exit /b 0
:fail
echo Build failed.
pause
exit /b 1
