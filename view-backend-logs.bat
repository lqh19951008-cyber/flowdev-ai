@echo off
chcp 65001 >nul
title FlowDev-AI 后端实时运行日志
cd /d "%~dp0"
echo ============================================================
echo   FlowDev-AI 后端实时运行日志监控 (UTF-8 编码, Ctrl+C 退出)
echo   监控目标: %~dp0backend\flowdev.log
echo ============================================================
powershell -NoExit -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Encoding utf8 -Path 'backend\flowdev.log' -Wait -Tail 30"
