$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$electronExe = Join-Path $projectRoot "node_modules\electron\dist\electron.exe"

if (-not (Test-Path $electronExe)) {
    throw "Electron executable was not found at $electronExe. Run npm install first."
}

Start-Process -FilePath $electronExe -WorkingDirectory $projectRoot -ArgumentList "." -WindowStyle Normal | Out-Null
