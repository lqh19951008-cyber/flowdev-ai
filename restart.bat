@echo off
chcp 65001 >nul
title FlowDev-AI ????
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0manage.ps1" -Action restart %*
if "%1"=="" (
    echo.
    echo ??????...
    pause >nul
)
