param(
  [string]$Version = "latest"
)

$Repo = "umeraamir09/SpoTUI"
$InstallDir = $env:SPOTUI_INSTALL
if (-not $InstallDir) {
  $InstallDir = Join-Path $env:LOCALAPPDATA "Programs\SpoTUI"
}

$Arch = switch ([Environment]::GetEnvironmentVariable("PROCESSOR_ARCHITECTURE")) {
  "AMD64" { "x64" }
  "ARM64" { "arm64" }
  default { Write-Error "Unsupported architecture"; exit 1 }
}

$Platform = "win-${Arch}"

if ($Version -eq "latest") {
  $Url = "https://github.com/${Repo}/releases/latest/download/spotui-${Platform}.exe"
} else {
  $Url = "https://github.com/${Repo}/releases/download/${Version}/spotui-${Platform}.exe"
}

Write-Host "Downloading spotui for ${Platform}..."
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$OutFile = Join-Path $InstallDir "spotui.exe"
Invoke-WebRequest -Uri $Url -OutFile $OutFile

Write-Host "Adding to PATH..."
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
}

Write-Host "Installed! Run 'spotui' to start."
