@echo off
title CafeMM Windows Print Agent
cls
echo ========================================================
echo    CafeMM Windows Thermal Print Agent for XPrinter
echo ========================================================
echo.
echo Checking for Node.js runtime...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on this computer!
    echo Please download and install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0"
echo Starting Print Agent on http://127.0.0.1:23456...
node server.js

if %errorlevel% neq 0 (
    echo.
    echo Print agent terminated unexpectedly.
    pause
)
