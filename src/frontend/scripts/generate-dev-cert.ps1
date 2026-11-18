$ErrorActionPreference = 'Stop'
$certDirectory = Join-Path $PSScriptRoot '../certs'
$keyPath = Join-Path $certDirectory 'localhost-key.pem'
$certPath = Join-Path $certDirectory 'localhost.pem'
if ((Test-Path -LiteralPath $keyPath) -or (Test-Path -LiteralPath $certPath)) {
  throw 'Existing certificate/key found; no files overwritten.'
}
New-Item -ItemType Directory -Force -Path $certDirectory | Out-Null
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
try {
  $request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    'CN=localhost', $rsa, [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
  $san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
  $san.AddDnsName('localhost')
  $san.AddIpAddress([System.Net.IPAddress]::Loopback)
  $san.AddIpAddress([System.Net.IPAddress]::IPv6Loopback)
  $request.CertificateExtensions.Add($san.Build())
  $request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true))
  $certificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-5), [DateTimeOffset]::UtcNow.AddDays(30))
  try {
    [System.IO.File]::WriteAllText($keyPath, $rsa.ExportPkcs8PrivateKeyPem())
    [System.IO.File]::WriteAllText($certPath, $certificate.ExportCertificatePem())
  } finally { $certificate.Dispose() }
} finally { $rsa.Dispose() }
Write-Output 'Created local HTTPS files. Browser trust was not changed.'
