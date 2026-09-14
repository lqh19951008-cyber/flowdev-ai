# ==============================================================================
# FlowDev-AI 一键重启服务脚本 (Restart Service)
# ==============================================================================
[CmdletBinding()]
param(
    [switch]$NoBrowser,
    [switch]$FollowLogs
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = $PSScriptRoot

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "                    FlowDev-AI 智能全栈开发流 - 服务重启器                      " -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[第 1 阶段] 正在停止现有服务..." -ForegroundColor Yellow
& "$ProjectRoot\stop.ps1"

Write-Host ""
Write-Host "[第 2 阶段] 正在重新启动服务..." -ForegroundColor Yellow
Start-Sleep -Seconds 1

$startArgs = @{}
if ($NoBrowser) { $startArgs["NoBrowser"] = $true }
if ($FollowLogs) { $startArgs["FollowLogs"] = $true }

& "$ProjectRoot\start.ps1" @startArgs
