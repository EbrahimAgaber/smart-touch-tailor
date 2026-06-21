@echo off
REM =============================================================================
REM  ZATCA fatoora Path-Bug Bypass Wrapper  v4
REM
REM  Key learnings from readme.md:
REM  - Correct validation flag is:  fatoora -validate -invoice <filename>
REM  - NOT -reportingMode offline (that flag does not exist in this SDK)
REM  - The SDK uses Data/Certificates/cert.pem + ec-secp256k1-priv-key.pem
REM    to verify the invoice signature -- those must match the signing key
REM
REM  Path-bug bypass (still required):
REM  - pushd into Apps/ and pass bare filename only -- no absolute path
REM  - Set FATOORA_HOME before calling fatoora.bat (fatoora.bat needs it)
REM
REM  USAGE (called by run-validator.js -- do not call directly):
REM    validate.bat <absolute-path-to-xml-already-copied-into-Apps/>
REM =============================================================================

SETLOCAL EnableDelayedExpansion

SET "INPUT_XML=%~1"
IF "%INPUT_XML%"=="" (
    echo [validate.bat] ERROR: No XML file argument provided.
    exit /b 1
)

REM Resolve SDK Apps/ directory relative to THIS script (C:\my-pos\v2\)
SET "SDK_APPS=%~dp0zatca-einvoicing-sdk-Java-238-R3.4.8\Apps"
IF "!SDK_APPS:~-1!"=="\" SET "SDK_APPS=!SDK_APPS:~0,-1!"

IF NOT EXIST "%SDK_APPS%\fatoora.bat" (
    echo [validate.bat] ERROR: fatoora.bat not found in: %SDK_APPS%
    exit /b 1
)

REM Extract just the bare filename
FOR %%F IN ("%INPUT_XML%") DO SET "XML_FILENAME=%%~nxF"

IF NOT EXIST "%SDK_APPS%\%XML_FILENAME%" (
    echo [validate.bat] ERROR: File not found in Apps/: %XML_FILENAME%
    echo [validate.bat] run-validator.js must copy it there first.
    exit /b 1
)

echo [validate.bat] FATOORA_HOME : %SDK_APPS%
echo [validate.bat] Validating   : %XML_FILENAME%
echo.

REM Set FATOORA_HOME so fatoora.bat can find jq + the JAR
SET "FATOORA_HOME=%SDK_APPS%"

REM CRITICAL: pushd into Apps/ -- bare filename avoids WindowsPathParser NPE
pushd "%SDK_APPS%"
call fatoora.bat -validate -invoice "%XML_FILENAME%"
SET "EXITCODE=%ERRORLEVEL%"
popd

ENDLOCAL
exit /b %EXITCODE%
