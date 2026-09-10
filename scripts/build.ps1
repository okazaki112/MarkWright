#Requires -Version 5.1
<#
.SYNOPSIS
    MarkWright 快速构建入口 —— 默认同时产出「便携版 + 安装包」。

.DESCRIPTION
    本脚本原来用 `tauri build --no-bundle`，因此只有单个便携 exe，没有任何安装包。
    现在改为转发到功能完整的 scripts/build-release.ps1，一次构建得到：

        发布版\<版本>\windows\
          ├─ markwright.exe                     便携版（免安装，双击即用）
          ├─ MarkWright_<版本>_x64-setup.exe    NSIS 安装包（体积小，带开始菜单/卸载）
          ├─ MarkWright_<版本>_x64_en-US.msi    MSI 安装包（走系统「应用和功能」卸载）
          ├─ checksums.csv                      SHA256 校验
          └─ 安装说明.md                        安装步骤与解除 SmartScreen 拦截说明

    为什么是「转发」而不是把打包逻辑复制一份：
    安装包收集、产物强校验、打包失败自动降级为便携版、cargo 镜像等流程
    都已完整实现并验证在 build-release.ps1 中，复制会产生两处维护点。

    实现细节：转发必须用 **哈希 splat**（`& script @hashtable`）。
    数组 splat（`@('-SkipInstall')`）是按「位置参数」传递的，`-SkipInstall`
    会被当成值塞给第一个字符串参数，导致开关失效 —— 这是本脚本修复过的坑。

.PARAMETER NoBundle
    只生成便携版 markwright.exe，不做安装包（等价于旧 build.ps1 的行为）。

.PARAMETER Bundles
    指定打包目标，如 nsis 或 msi,nsis；省略时按 tauri.conf.json 的 bundle.targets（all → msi + nsis）。

.PARAMETER SkipInstall
    跳过 npm install（依赖已装好时用）。

.PARAMETER SkipFrontend
    跳过前端构建，复用已有 dist/。

.PARAMETER Clean
    构建前清理 dist/ 与 发布版\<版本>\。

.PARAMETER CargoMirror
    临时启用 USTC crates 镜像，构建结束后自动移除。

.EXAMPLE
    pwsh ./scripts/build.ps1
    pwsh ./scripts/build.ps1 -Bundles nsis
    pwsh ./scripts/build.ps1 -NoBundle
    pwsh ./scripts/build.ps1 -SkipInstall -SkipFrontend
#>
[CmdletBinding()]
param(
    [switch]$NoBundle,
    [string]$Bundles = '',
    [switch]$SkipInstall,
    [switch]$SkipFrontend,
    [switch]$Clean,
    [switch]$CargoMirror
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$Full = Join-Path $PSScriptRoot 'build-release.ps1'
if (-not (Test-Path $Full)) {
    throw "未找到 $Full —— 请确认 scripts/ 目录完整"
}

# ---- 组装转发参数（哈希 splat：只有哈希才能绑定命名开关）
$forward = @{}
if ($NoBundle)     { $forward['NoBundle']     = $true }
if ($Bundles)      { $forward['Bundles']      = $Bundles }
if ($SkipInstall)  { $forward['SkipInstall']  = $true }
if ($SkipFrontend) { $forward['SkipFrontend'] = $true }
if ($Clean)        { $forward['Clean']        = $true }
if ($CargoMirror)  { $forward['CargoMirror']  = $true }

# ---- 回显将要执行的模式
$mode = if ($NoBundle) { '仅便携版（不做安装包）' }
        elseif ($Bundles) { "便携版 + 安装包（$Bundles）" }
        else { '便携版 + 安装包（tauri.conf.json: all → msi + nsis）' }
$shown = if ($forward.Count) { ($forward.GetEnumerator() | ForEach-Object { "-$($_.Key)" }) -join ' ' } else { '(无)' }

Write-Host ''
Write-Host '  MarkWright 构建' -ForegroundColor Magenta
Write-Host "  产物模式 : $mode"
Write-Host "  转发参数 : $shown" -ForegroundColor DarkGray
Write-Host ''

& $Full @forward
exit $LASTEXITCODE
