<#
.SYNOPSIS
  Бекап MongoDB бази Атлеті через mongodump.
.EXAMPLE
  pnpm backup
  powershell -File scripts/backup-db.ps1 -Keep 20 -OutDir D:\atleti-backups
#>
param(
    [string]$EnvFile = "apps/web/.env.local",
    [string]$OutDir  = "backups",
    [int]$Keep       = 10
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

# mongodump не в PATH при стандартній установці MongoDB Database Tools
$mongodump = (Get-Command mongodump -ErrorAction SilentlyContinue).Source
if (-not $mongodump) {
    $candidates = Get-ChildItem "C:\Program Files\MongoDB\Tools\*\bin\mongodump.exe" -ErrorAction SilentlyContinue
    if ($candidates) { $mongodump = $candidates[-1].FullName }
}
if (-not $mongodump) {
    Write-Error "mongodump не знайдено. Встанови MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools"
}

if (-not (Test-Path $EnvFile)) { Write-Error "Немає файлу $EnvFile" }

# Беремо останній розкоментований MONGODB_URI — як це робить dotenv
$uri = Get-Content $EnvFile |
    Where-Object { $_ -match '^\s*MONGODB_URI\s*=' } |
    Select-Object -Last 1
if (-not $uri) { Write-Error "MONGODB_URI не знайдено в $EnvFile" }
$uri = ($uri -replace '^\s*MONGODB_URI\s*=\s*', '').Trim().Trim('"').Trim("'")

$stamp  = Get-Date -Format "yyyy-MM-dd_HHmmss"
$target = Join-Path $OutDir $stamp
New-Item -ItemType Directory -Force -Path $target | Out-Null

$host_ = ($uri -replace '^mongodb(\+srv)?://[^@]*@', '') -replace '\?.*$', ''
Write-Host "Бекап $host_ -> $target"
& $mongodump --uri="$uri" --out="$target" --quiet
if ($LASTEXITCODE -ne 0) { Write-Error "mongodump завершився з кодом $LASTEXITCODE" }

$size = (Get-ChildItem $target -Recurse -File | Measure-Object -Property Length -Sum).Sum
if (-not $size) { Write-Error "Бекап порожній — щось пішло не так" }
Write-Host ("Готово: {0:N0} KB" -f ($size / 1KB))

# Ротація: лишаємо $Keep найсвіжіших
if ($Keep -gt 0) {
    Get-ChildItem $OutDir -Directory |
        Sort-Object Name -Descending |
        Select-Object -Skip $Keep |
        ForEach-Object {
            Write-Host "Видаляю старий бекап: $($_.Name)"
            Remove-Item $_.FullName -Recurse -Force -Confirm:$false
        }
}
