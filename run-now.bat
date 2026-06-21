@echo off
REM =============================================================================
REM  run-now.bat  --  One-click: Sign invoice then validate with fatoora
REM
REM  Run this from C:\my-pos\v2\ by double-clicking or:
REM    cd C:\my-pos\v2
REM    run-now.bat
REM =============================================================================

SETLOCAL
SET "PROJECT_ROOT=%~dp0"
IF "%PROJECT_ROOT:~-1%"=="\" SET "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

cd /d "%PROJECT_ROOT%"

echo.
echo ============================================================
echo  Step 1/2: Generating P1363-signed invoice XML
echo ============================================================
echo.
node sign_invoice.js
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FAILED] sign_invoice.js exited with error %ERRORLEVEL%
    echo Check the output above. Common causes:
    echo   - node_modules not installed: run  npm install
    echo   - node-forge missing: run  npm install node-forge
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  Step 2/2: Validating with ZATCA fatoora SDK
echo ============================================================
echo.
node run-validator.js sample_fixed_invoice.xml
SET "VCODE=%ERRORLEVEL%"

echo.
IF %VCODE% EQU 0 (
    echo  SUCCESS: Validator exited cleanly.
) ELSE (
    echo  VALIDATOR returned exit code %VCODE%
    echo  Read the output above for specific error messages.
    echo  NOTE: fatoora exit code 1 can still mean partial pass -- check the
    echo        validation report lines for ERROR vs WARNING vs PASS.
)

echo.
pause
ENDLOCAL
