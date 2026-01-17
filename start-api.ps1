Write-Host "🚀 Iniciando API do Sistema Bar..."
$apiDir = Join-Path $PSScriptRoot "api"
Set-Location $apiDir
$envPath = Join-Path $apiDir ".env"
if (!(Test-Path $envPath)) { Copy-Item (Join-Path $apiDir "env_exemplo") $envPath }
$envLines = Get-Content $envPath
$portSet = $false
$hostSet = $false
$updated = @()
foreach ($line in $envLines) {
  if ($line -match '^PORT=') { $portSet = $true; $updated += 'PORT=4000' }
  elseif ($line -match '^HOST=') { $hostSet = $true; $updated += 'HOST=0.0.0.0' }
  else { $updated += $line }
}
if (-not $portSet) { $updated += 'PORT=4000' }
if (-not $hostSet) { $updated += 'HOST=0.0.0.0' }
$updated | Set-Content -Encoding utf8 $envPath
$lanIp = $null
try {
  $lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notmatch '^169\.254\.' } | Select-Object -ExpandProperty IPAddress -First 1)
} catch {}
if (-not $lanIp -or $lanIp.Trim() -eq '') {
  try {
    $lanIp = ([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) | Where-Object { $_.AddressFamily -eq 'InterNetwork' -and $_.IPAddressToString -ne '127.0.0.1' } | Select-Object -ExpandProperty IPAddressToString -First 1)
  } catch {}
}
if ($lanIp -and $lanIp.Trim() -ne '') {
  $lanIpStr = [string]$lanIp
  Write-Host "API LAN URL: http://$lanIpStr:4000/api"
} else { Write-Host "API LAN URL: não detectado" }
if (!(Test-Path (Join-Path $apiDir "node_modules"))) { npm install }
try {
  $cons = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
  if ($cons) { $pids = $cons | Select-Object -ExpandProperty OwningProcess | Select-Object -Unique; foreach ($pid in $pids) { try { Stop-Process -Id $pid -Force } catch {} } }
} catch {}
try { npx prisma db push --accept-data-loss *> $null } catch {}
try { npx prisma generate *> $null } catch {}
npm start
