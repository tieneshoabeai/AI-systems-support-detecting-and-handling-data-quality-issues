param(
  [Parameter(Mandatory = $true)]
  [string] $SwaggerUrl,

  [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$')]
  [string] $EnvironmentId = 'qa-main',

  [string[]] $PreviousSwaggerUrl = @(),

  [int] $Port = 5180
)

$ErrorActionPreference = 'Stop'

function ConvertFrom-SwaggerUrl([string] $Value) {
  $parsed = [Uri]::new($Value.Trim(), [UriKind]::Absolute)
  if ($parsed.Scheme -notin @('http', 'https') -or $parsed.UserInfo -or $parsed.Query -or $parsed.Fragment) {
    throw 'Swagger URL must be an HTTP(S) docs URL without credentials, query, or fragment.'
  }
  if ($parsed.AbsolutePath -notmatch '^(/api/v[0-9]+)/(docs|docs-json)/?$') {
    throw 'Swagger URL must end with /api/v1/docs or /api/v1/docs-json.'
  }
  return [pscustomobject]@{
    BaseUrl = $parsed.GetLeftPart([UriPartial]::Authority)
    Prefix = $Matches[1]
  }
}

$api = ConvertFrom-SwaggerUrl $SwaggerUrl
$previous = @($PreviousSwaggerUrl | ForEach-Object { (ConvertFrom-SwaggerUrl $_).BaseUrl + (ConvertFrom-SwaggerUrl $_).Prefix } | Select-Object -Unique)
$frontendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$env:VITE_API_BASE_URL = $api.BaseUrl
$env:VITE_API_PREFIX = $api.Prefix
$env:VITE_API_ENVIRONMENT_ID = $EnvironmentId
$env:VITE_API_MIGRATE_FROM = $previous -join ','
$env:VITE_MANAGEMENT_DATA_MODE = 'api'
$env:DEV_HTTPS = 'false'

Write-Host "Frontend environment: $EnvironmentId"
Write-Host "Backend API: $($api.BaseUrl)$($api.Prefix)"
if ($previous.Count -gt 0) { Write-Host "Migration sources configured: $($previous.Count)" }
Write-Host "Frontend URL: http://127.0.0.1:$Port/auth/login"

Push-Location $frontendRoot
try {
  & yarn.cmd dev --host 127.0.0.1 --port $Port --strictPort --open /auth/login
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally { Pop-Location }
