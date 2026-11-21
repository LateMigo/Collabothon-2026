@echo off
setlocal EnableExtensions
title CosmiCash - setup
cd /d "%~dp0"

echo.
echo  ==========================================
echo   FINANCE QUEST - one-time setup
echo  ==========================================
echo.

rem ---------- 1. Find Python 3.11+ ----------
set "PY="
where py >nul 2>nul && py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul && set "PY=py -3"
if not defined PY (
    where python >nul 2>nul && python -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul && set "PY=python"
)
if not defined PY (
    echo [ERROR] Python 3.11 or newer was not found.
    echo         Install it from https://www.python.org/downloads/
    echo         and tick "Add python.exe to PATH" during installation.
    goto :fail
)
echo [OK] Python found: %PY%

rem ---------- 2. Find Node.js / npm ----------
where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js / npm was not found.
    echo         Install Node.js 18 or newer from https://nodejs.org/
    goto :fail
)
echo [OK] Node.js found.
echo.

rem ---------- 3. Backend: virtual environment + packages ----------
echo [1/3] Installing backend packages...
if not exist "backend\.venv\Scripts\python.exe" (
    %PY% -m venv "backend\.venv"
    if errorlevel 1 (
        echo [ERROR] Could not create backend\.venv
        goto :fail
    )
)
"backend\.venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
"backend\.venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt" --quiet
if errorlevel 1 (
    echo [ERROR] pip install failed. Check your internet connection and try again.
    goto :fail
)
echo [OK] Backend packages installed.
echo.

rem ---------- 4. Backend: .env file ----------
echo [2/3] Preparing backend\.env ...
if exist "backend\.env" (
    echo [OK] backend\.env already exists - left unchanged.
) else (
    copy "backend\.env.example" "backend\.env" >nul
    echo [OK] Created backend\.env from .env.example
    echo      Optional: paste your Gemini key into GEMINI_API_KEY=
    echo      ^(free key: https://aistudio.google.com/apikey^). Without a key the game
    echo      runs fully on the offline AI.
)
echo.

rem ---------- 5. Frontend packages ----------
echo [3/3] Installing frontend packages (this can take a minute)...
pushd frontend
call npm install --no-audit --no-fund
set "NPM_RESULT=%errorlevel%"
popd
if not "%NPM_RESULT%"=="0" (
    echo [ERROR] npm install failed. Check your internet connection and try again.
    goto :fail
)
echo [OK] Frontend packages installed.

echo.
echo  ==========================================
echo   Setup complete! Double-click start.bat
echo   to launch the game.
echo  ==========================================
echo.
if not defined FQ_NO_PAUSE pause
exit /b 0

:fail
echo.
echo Setup did not finish. Fix the problem above and run setup.bat again.
echo.
if not defined FQ_NO_PAUSE pause
exit /b 1
