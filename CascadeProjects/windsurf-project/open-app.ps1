$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$electronExe = Join-Path $projectRoot "node_modules\electron\dist\electron.exe"

if (-not (Test-Path $electronExe)) {
    Write-Host "Electron not found. Installing dependencies..."
    Set-Location $projectRoot
    npm install
    if (-not (Test-Path $electronExe)) {
        throw "Electron executable was not found at $electronExe. Run npm install first."
    }
}

# Load environment variables from .env file
$envFile = Join-Path $projectRoot ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $name = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$storedOpenAIKey = [Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "User")
if (-not $env:OPENAI_API_KEY -and $storedOpenAIKey) {
    $env:OPENAI_API_KEY = $storedOpenAIKey
}

$storedOpenAIModel = [Environment]::GetEnvironmentVariable("OPENAI_MODEL", "User")
if (-not $env:OPENAI_MODEL -and $storedOpenAIModel) {
    $env:OPENAI_MODEL = $storedOpenAIModel
}

Write-Host "Starting JohnyBrowserHub..."
Start-Process -FilePath $electronExe -WorkingDirectory $projectRoot -ArgumentList "." -WindowStyle Normal | Out-Null
