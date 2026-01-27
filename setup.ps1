# Setup script for Windows

Write-Host "Setting up Progress OS..." -ForegroundColor Cyan

# Check Node.js version
$nodeVersion = node -v
if ($nodeVersion -notmatch 'v(\d+)') {
    Write-Host "Error: Node.js not found" -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

$majorVersion = [int]$Matches[1]
if ($majorVersion -lt 18) {
    Write-Host "Error: Node.js 18 or higher is required" -ForegroundColor Red
    Write-Host "Current version: $nodeVersion" -ForegroundColor Yellow
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

Write-Host "Node.js $nodeVersion detected" -ForegroundColor Green

# Check npm version
$npmVersion = npm -v
Write-Host "npm $npmVersion detected" -ForegroundColor Green

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "Error: package.json not found" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory" -ForegroundColor Yellow
    exit 1
}

# Install root dependencies
Write-Host "Installing root dependencies..." -ForegroundColor Cyan
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to install root dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "Root dependencies installed" -ForegroundColor Green

# Install main process dependencies
Write-Host "Installing main process dependencies..." -ForegroundColor Cyan
Set-Location main
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to install main process dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "Main process dependencies installed" -ForegroundColor Green

# Install renderer dependencies
Write-Host "Installing renderer dependencies..." -ForegroundColor Cyan
Set-Location ../renderer
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to install renderer dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "Renderer dependencies installed" -ForegroundColor Green

# Build better-sqlite3
Write-Host "Building better-sqlite3..." -ForegroundColor Cyan
Set-Location ../main
npm rebuild better-sqlite3

if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: Failed to rebuild better-sqlite3. Trying with npm rebuild..." -ForegroundColor Yellow
    npm rebuild
}

Write-Host "better-sqlite3 built successfully" -ForegroundColor Green

# Return to root directory
Set-Location ..

# Create build directories
Write-Host "Creating build directories..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path build, dist | Out-Null

# Check for icon files
if (!(Test-Path "build/icon.png")) {
    Write-Host "Warning: Icon files not found in build directory" -ForegroundColor Yellow
    Write-Host "Please add your own icons to the build/ directory:" -ForegroundColor Cyan
    Write-Host "  - A 256x256 PNG icon at build/icon.png" -ForegroundColor Cyan
    Write-Host "  - A Windows ICO icon at build/icon.ico" -ForegroundColor Cyan
    Write-Host "  - A macOS ICNS icon at build/icon.icns" -ForegroundColor Cyan
    Write-Host "You can create placeholder icons using an image editor." -ForegroundColor Cyan
} else {
    Write-Host "Icon files found" -ForegroundColor Green
}

# Create database template
Write-Host "Creating database template..." -ForegroundColor Cyan
if (!(Test-Path "database/template.db")) {
    if (Test-Path "database/schema.db") {
        Copy-Item "database/schema.db" "database/template.db"
    }
}

Write-Host "`nSetup complete!" -ForegroundColor Green
Write-Host "================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start in development mode:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor Green
Write-Host ""
Write-Host "To build for production:" -ForegroundColor Cyan
Write-Host "  npm run build" -ForegroundColor Green
Write-Host "  npm run package" -ForegroundColor Green
Write-Host ""
Write-Host "To run tests:" -ForegroundColor Cyan
Write-Host "  npm run test" -ForegroundColor Green
Write-Host ""
Write-Host "For more information, see README.md" -ForegroundColor Cyan
Write-Host ""