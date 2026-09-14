@echo off
chcp 65001 >nul
title FlowDev-AI 后端实时运行日志
echo ============================================================
echo  FlowDev-AI 后端实时日志监控窗口 (Ctrl+C 退出)
echo  日志文件: backend\flowdev.log
echo ============================================================
powershell -NoExit -Command "Get-Content -Path 'backend\flowdev.log' -Wait -Tail 40"
