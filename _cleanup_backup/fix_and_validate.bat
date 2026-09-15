@echo off
cd /d "C:\my-pos\v2"
echo.
echo [1/2] Applying ZATCA fixes and signing invoice...
node fix_zatca_inv.cjs
if errorlevel 1 (
    echo.
    echo ❌  fix_zatca_inv.cjs FAILED - check output above
    pause
    exit /b 1
)
echo.
echo [2/2] Running ZATCA SDK validation...
echo.
fatoora -validate -invoice "C:\my-pos\v2\ZATCA_INV-1781539765405.xml"
echo.
pause
