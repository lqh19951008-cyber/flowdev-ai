@echo off
chcp 65001 >nul
title FlowDev-AI 一站式服务管理控制台
cd /d "%~dp0"

if "%1"=="" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0manage.ps1" -Action menu
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0manage.ps1" -Action %*
)
