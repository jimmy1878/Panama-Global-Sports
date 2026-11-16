# Copia una migración completa al portapapeles, para pegarla en el SQL Editor
# de Supabase. Existe porque la cuenta no tiene permiso `database_write` y
# `npm run db:push` no puede aplicarlas: hay que pegarlas a mano, y una
# migración copiada a medias deja la base como estaba (sin avisar).
#
# Uso:
#   .\scripts\copiar-migracion.ps1              la migración más reciente
#   .\scripts\copiar-migracion.ps1 20261115000900_sponsorships.sql
param(
  [string]$Nombre
)

$ErrorActionPreference = 'Stop'
$carpeta = Join-Path (Split-Path -Parent $PSScriptRoot) 'supabase\migrations'

if ($Nombre) {
  $archivo = Join-Path $carpeta $Nombre
  if (-not (Test-Path $archivo)) { throw "No encontré $archivo" }
} else {
  $archivo = (Get-ChildItem -Path $carpeta -Filter *.sql | Sort-Object Name | Select-Object -Last 1).FullName
}

$sql = Get-Content -Raw -Encoding UTF8 -Path $archivo
Set-Clipboard -Value $sql

$lineas = ($sql -split "`n").Count
Write-Host ""
Write-Host "Copiado al portapapeles:" -ForegroundColor Green
Write-Host "  $(Split-Path -Leaf $archivo)"
Write-Host "  $lineas lineas, $($sql.Length) caracteres"
Write-Host ""
Write-Host "Ahora: SQL Editor de Supabase -> pegar (Ctrl+V) -> Run."
Write-Host "Si el editor dice Success, quedo aplicada."
Write-Host ""
