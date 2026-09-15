@echo off
chcp 65001 >nul
title FlowDev-AI 实时日志监控
cd /d "%~dp0"
echo ============================================================
echo   FlowDev-AI 实时运行日志 (UTF-8 编码, Ctrl+C 退出)
echo   日志文件: backend\flowdev.log
echo ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Content -Encoding utf8 -Path 'backend\flowdev.log' -Wait -Tail 30"
