$ErrorActionPreference = "Stop"

Write-Host "JohnyBrowserHub - OpenAI API Key Setup"
Write-Host "======================================="

# Get current key
$currentKey = [Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "User")
$currentModel = [Environment]::GetEnvironmentVariable("OPENAI_MODEL", "User")

if ($currentKey) {
    Write-Host "Current API Key: $($currentKey.Substring(0, 10))..." -ForegroundColor Green
} else {
    Write-Host "No API Key currently set." -ForegroundColor Yellow
}

if ($currentModel) {
    Write-Host "Current Model: $currentModel" -ForegroundColor Green
} else {
    Write-Host "Using default model: gpt-4o-mini" -ForegroundColor Yellow
}

Write-Host ""

# Prompt for new key
$newKey = Read-Host "Enter your OpenAI API Key (or press Enter to keep current)"
if ($newKey) {
    [Environment]::SetEnvironmentVariable("OPENAI_API_KEY", $newKey, "User")
    Write-Host "API Key updated successfully!" -ForegroundColor Green
    
    # Also update .env file
    $envFile = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) ".env"
    $envContent = Get-Content $envFile -ErrorAction SilentlyContinue
    if ($envContent) {
        $envContent = $envContent -replace '^OPENAI_API_KEY=.*', "OPENAI_API_KEY=$newKey"
        $envContent | Set-Content $envFile
    } else {
        "OPENAI_API_KEY=$newKey" | Set-Content $envFile
    }
}

# Prompt for model
$newModel = Read-Host "Enter OpenAI model (gpt-4o-mini, gpt-4, etc.) or press Enter for default"
if ($newModel) {
    [Environment]::SetEnvironmentVariable("OPENAI_MODEL", $newModel, "User")
    Write-Host "Model updated successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Setup complete! You can now run 'npm start' to launch the application." -ForegroundColor Cyan
