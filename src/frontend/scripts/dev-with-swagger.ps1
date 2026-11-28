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
  try { $parsed = [Uri]::new($Value.Trim(), [UriKind]::Absolute) }
  catch { throw 'Swagger URL không phải URL tuyệt đối hợp lệ.' }
  if ($parsed.Scheme -ne 'https' -or $parsed.UserInfo -or $parsed.Query -or $parsed.Fragment) {
    throw 'Swagger URL phải dùng HTTPS và không được có credentials, query hoặc fragment.'
  }
  if ($parsed.AbsolutePath -notmatch '^/api/v1/docs(?:-json)?/?$') {
    throw 'Swagger URL phải kết thúc bằng /api/v1/docs hoặc /api/v1/docs-json.'
  }
  return [pscustomobject]@{
    Origin = $parsed.GetLeftPart([UriPartial]::Authority)
    Prefix = '/api/v1'
  }
}

function Get-RootHash([string] $Value) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value.ToLowerInvariant())
    $hash = $sha.ComputeHash($bytes)
    return ([System.BitConverter]::ToString($hash).Replace('-', '').Substring(0, 16).ToLowerInvariant())
  }
  finally { $sha.Dispose() }
}

function Invoke-ControlRequest($Descriptor, [string] $Method, [string] $Path, $Body = $null) {
  Add-Type -AssemblyName System.Net.Http
  $handler = [System.Net.Http.HttpClientHandler]::new()
  $handler.UseProxy = $false
  $client = [System.Net.Http.HttpClient]::new($handler)
  $request = $null
  try {
    $request = [System.Net.Http.HttpRequestMessage]::new(
      [System.Net.Http.HttpMethod]::new($Method),
      "http://127.0.0.1:$($Descriptor.controlPort)$Path"
    )
    $request.Headers.Add('X-Vite-Control-Token', [string]$Descriptor.token)
    if ($null -ne $Body) {
      $json = ConvertTo-Json -InputObject $Body -Compress -Depth 5
      $request.Content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, 'application/json')
    }
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $payload = $null
    try { $payload = $content | ConvertFrom-Json } catch {}
    return [pscustomobject]@{ StatusCode = [int]$response.StatusCode; Payload = $payload }
  }
  finally {
    if ($request) { $request.Dispose() }
    $client.Dispose()
    $handler.Dispose()
  }
}

function Complete-TargetUpdate($Descriptor, $InitialResponse) {
  if ($InitialResponse.StatusCode -ne 202) {
    $message = if ($InitialResponse.Payload.message) { $InitialResponse.Payload.message } else { 'Vite từ chối cập nhật API đích.' }
    throw $message
  }

  $requestId = [string]$InitialResponse.Payload.requestId
  Write-Host "URL hợp lệ: $SwaggerUrl"
  Write-Host "API target: $($api.Origin)$($api.Prefix)"
  Write-Host "Đang chờ tab xác nhận (EnvironmentId: $EnvironmentId)."
  $previousState = 'waiting_for_tab'
  $deadline = [DateTime]::UtcNow.AddSeconds(210)
  while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 800
    $statusResponse = Invoke-ControlRequest $Descriptor 'GET' "/__dev/api-target/status?requestId=$requestId"
    if ($statusResponse.StatusCode -ne 200 -or $null -eq $statusResponse.Payload) {
      throw 'Mất kết nối tới control endpoint của Vite trong khi chờ trạng thái.'
    }
    $status = $statusResponse.Payload
    if ($status.state -ne $previousState) {
      Write-Host ([string]$status.message)
      $previousState = [string]$status.state
    }
    if ($status.state -eq 'backend_ready') { return }
    if ($status.state -in @('backend_unavailable', 'rejected')) { throw [string]$status.message }
  }
  throw 'Hết thời gian chờ tab xác nhận URL/backend hoặc phiên đăng nhập.'
}

$api = ConvertFrom-SwaggerUrl $SwaggerUrl
foreach ($previousUrl in $PreviousSwaggerUrl) { $null = ConvertFrom-SwaggerUrl $previousUrl }
if ($Port -lt 1024 -or $Port -gt 65534) { throw 'Port Vite phải nằm trong khoảng 1024–65534.' }
$frontendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$frontendRootLower = $frontendRoot.ToLowerInvariant()
$rootHash = Get-RootHash $frontendRootLower
$controlDirectory = if ($env:LOCALAPPDATA) {
  Join-Path (Join-Path $env:LOCALAPPDATA 'ThuongFEAI') 'vite-control'
} else {
  Join-Path ([System.IO.Path]::GetTempPath()) 'thuongfeai-vite-control'
}

$descriptorFiles = @()
if (Test-Path -LiteralPath $controlDirectory) {
  $descriptorFiles = @(Get-ChildItem -LiteralPath $controlDirectory -Filter "vite-control-$rootHash-*.json" -File |
    Sort-Object LastWriteTime -Descending)
}
$portWasSpecified = $PSBoundParameters.ContainsKey('Port')
$respondingViteFound = $false

foreach ($file in $descriptorFiles) {
  try { $descriptor = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json }
  catch { continue }
  if ($descriptor.root.ToLowerInvariant() -ne $frontendRootLower) { continue }
  if ($portWasSpecified -and [int]$descriptor.vitePort -ne $Port) { continue }
  if (-not $descriptor.token -or -not $descriptor.controlPort) { continue }

  $initial = $null
  try {
    $initial = Invoke-ControlRequest $descriptor 'POST' '/__dev/api-target' @{
      swaggerUrl = $SwaggerUrl.Trim()
      environmentId = $EnvironmentId
    }
  }
  catch { continue }

  $respondingViteFound = $true
  Complete-TargetUpdate $descriptor $initial
  exit 0
}

if ($respondingViteFound) { exit 1 }

$env:VITE_API_BASE_URL = $api.Origin
$env:VITE_API_PREFIX = $api.Prefix
$env:VITE_API_ENVIRONMENT_ID = $EnvironmentId
$env:DEV_HTTPS = 'false'

Write-Host "Swagger URL hợp lệ. Khởi động Vite trên 127.0.0.1:$Port với EnvironmentId $EnvironmentId."
Write-Host 'Vite sẽ không tự mở tab trình duyệt.'
Push-Location $frontendRoot
try {
  & yarn.cmd dev -- --host 127.0.0.1 --port $Port --strictPort
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
finally { Pop-Location }
