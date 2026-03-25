param(
  [Parameter(Mandatory = $true)]
  [string]$InputFile,

  [Parameter(Mandatory = $true)]
  [string]$PfxPath,

  [Parameter(Mandatory = $true)]
  [string]$PfxPassword,

  [string]$TimeStampUrl = "http://timestamp.digicert.com",

  [string]$DigestAlgorithm = "SHA256"
)

$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue

if (-not $signtool) {
  throw "未找到 signtool.exe。请先安装 Windows SDK 或 Visual Studio Signing Tools。"
}

if (-not (Test-Path $InputFile)) {
  throw "待签名文件不存在：$InputFile"
}

if (-not (Test-Path $PfxPath)) {
  throw "PFX 证书不存在：$PfxPath"
}

& $signtool.Source sign `
  /f $PfxPath `
  /p $PfxPassword `
  /fd $DigestAlgorithm `
  /td $DigestAlgorithm `
  /tr $TimeStampUrl `
  $InputFile

if ($LASTEXITCODE -ne 0) {
  throw "签名失败，signtool 返回码：$LASTEXITCODE"
}

Write-Host "签名完成：" $InputFile
