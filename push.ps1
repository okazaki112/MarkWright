# push.ps1 — MarkWright 一键推送到 GitHub
# 用法：powershell -ExecutionPolicy Bypass -File .\push.ps1
# 目标仓库：https://github.com/okazaki112/MarkWright

$REMOTE = 'https://github.com/okazaki112/MarkWright.git'
$BRANCH = 'main'

# 切到脚本所在目录（即仓库根 mian/），保证从任意位置运行都正确
$repoDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoDir
Write-Host "==> 仓库目录: $repoDir" -ForegroundColor Cyan

# 1) 若当前不是 git 仓库则初始化
if (-not (Test-Path '.git')) {
    Write-Host '==> 初始化 git 仓库 (branch main)' -ForegroundColor Cyan
    git init -b $BRANCH
    if ($LASTEXITCODE -ne 0) { Write-Error 'git init 失败'; exit 1 }
}

# 2) 设置远程 origin（不存在则添加，已存在则更新 URL）
$existing = & git remote get-url origin 2>$null
if (-not $existing) {
    & git remote add origin $REMOTE
} else {
    & git remote set-url origin $REMOTE
}
Write-Host "==> 远程 origin: $REMOTE" -ForegroundColor Cyan

# 3) 暂存全部改动
& git add -A
if ($LASTEXITCODE -ne 0) { Write-Error 'git add 失败'; exit 1 }

# 4) 有改动才提交，否则跳过
$status = & git status --porcelain
if ($status) {
    $msg = "chore: update MarkWright source ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
    & git commit -m $msg
    if ($LASTEXITCODE -ne 0) { Write-Error 'git commit 失败'; exit 1 }
    Write-Host "==> 已提交: $msg" -ForegroundColor Green
} else {
    Write-Host '==> 无改动，跳过提交' -ForegroundColor Yellow
}

# 5) 推送（首次设置上游；若远端已有提交则先合并无关历史再推送）
$upstream = & git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null
try {
    if (-not $upstream) { & git push -u origin $BRANCH } else { & git push }
    if ($LASTEXITCODE -ne 0) { throw 'push 返回非零' }
    Write-Host '==> 推送完成 ✅' -ForegroundColor Green
} catch {
    Write-Host '==> 直接推送失败，尝试先合并远端（允许无关历史）再推送…' -ForegroundColor Yellow
    & git pull --allow-unrelated-histories origin $BRANCH
    if ($LASTEXITCODE -ne 0) { Write-Error 'git pull 失败，请手动处理冲突后重试'; exit 1 }
    & git push -u origin $BRANCH
    if ($LASTEXITCODE -ne 0) { Write-Error 'git push 仍失败'; exit 1 }
    Write-Host '==> 推送完成 ✅' -ForegroundColor Green
}
