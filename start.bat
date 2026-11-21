@echo off
setlocal EnableExtensions
title CosmiCash - launcher
cd /d "%~dp0"

echo.
echo  ==========================================
echo   FINANCE QUEST - starting the game
echo  ==========================================
echo.

rem ---------- Check that setup.bat was run ----------
if not exist "backend\.venv\Scripts\python.exe" (
    echo [ERROR] Backend packages are missing. Run setup.bat first.
    goto :fail
)
if not exist "frontend\node_modules" (
    echo [ERROR] Frontend packages are missing. Run setup.bat first.
    goto :fail
)
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
    echo [i] Created backend\.env - the game will use the offline AI until you add a Gemini key.
)

rem ---------- Backend on port 8000 ----------
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if errorlevel 1 (
    echo [1/2] Starting backend on http://localhost:8000 ...
    start "CosmiCash - backend (port 8000)" /D "%~dp0backend" cmd /k ".venv\Scripts\python.exe -m uvicorn app.main:app --port 8000"
) else (
    echo [1/2] Port 8000 is already in use - assuming the backend is already running.
)

rem ---------- Frontend on port 5173 ----------
netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul
if errorlevel 1 (
    echo [2/2] Starting frontend on http://localhost:5173 ...
    start "CosmiCash - frontend (port 5173)" /D "%~dp0frontend" cmd /k "npm run dev"
) else (
    echo [2/2] Port 5173 is already in use - assuming the frontend is already running.
)

rem ---------- Wait for the game page, then open the browser ----------
echo.
echo Waiting for the game to come online...
set /a TRIES=0

:waitloop
set /a TRIES+=1
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul || goto :notyet
netstat -ano | findstr /R /C:":5173 .*LISTENING" >nul || goto :notyet
goto :ready

:notyet
if %TRIES% GEQ 60 (
    echo [WARN] The servers did not start within 60 seconds.
    echo        Check the two server windows for error messages.
    goto :fail
)
rem ~1 second pause that also works without a keyboard attached
ping -n 2 127.0.0.1 >nul
goto :waitloop

:ready
echo [OK] Game is running: http://localhost:5173
if not defined FQ_NO_BROWSER start "" "http://localhost:5173"
echo.
echo Keep the two server windows open while you play.
echo To stop the game, close them (or press Ctrl+C inside each one).
echo.
if not defined FQ_NO_PAUSE timeout /t 8 >nul
exit /b 0

:fail
echo.
if not defined FQ_NO_PAUSE pause
exit /b 1
