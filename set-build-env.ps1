$MsvcBasePath = "D:\Build Tools For VS\VC\Tools\MSVC\14.44.35207"
$WinSdkBasePath = "C:\Program Files (x86)\Windows Kits\10"
$WinSdkVersion = "10.0.26100.0"

Write-Host "Setting up MSVC and Windows SDK Environment Variables..." -ForegroundColor Cyan

# 1. Update PATH for Linker and MSVC Tools
$MsvcBin = "$MsvcBasePath\bin\HostX64\x64"
$WinSdkBin = "$WinSdkBasePath\bin\$WinSdkVersion\x64"
$env:PATH = "$MsvcBin;$WinSdkBin;$env:PATH"

# 2. Update LIB
$MsvcLib = "$MsvcBasePath\lib\x64"
$WinSdkLibUcrt = "$WinSdkBasePath\Lib\$WinSdkVersion\ucrt\x64"
$WinSdkLibUm = "$WinSdkBasePath\Lib\$WinSdkVersion\um\x64"

if ($env:LIB) {
    $env:LIB = "$MsvcLib;$WinSdkLibUcrt;$WinSdkLibUm;$env:LIB"
} else {
    $env:LIB = "$MsvcLib;$WinSdkLibUcrt;$WinSdkLibUm"
}

# 3. Update INCLUDE
$MsvcInclude = "$MsvcBasePath\include"
$WinSdkIncludeUcrt = "$WinSdkBasePath\Include\$WinSdkVersion\ucrt"
$WinSdkIncludeShared = "$WinSdkBasePath\Include\$WinSdkVersion\shared"
$WinSdkIncludeUm = "$WinSdkBasePath\Include\$WinSdkVersion\um"
$WinSdkIncludeWinrt = "$WinSdkBasePath\Include\$WinSdkVersion\winrt"

if ($env:INCLUDE) {
    $env:INCLUDE = "$MsvcInclude;$WinSdkIncludeUcrt;$WinSdkIncludeShared;$WinSdkIncludeUm;$WinSdkIncludeWinrt;$env:INCLUDE"
} else {
    $env:INCLUDE = "$MsvcInclude;$WinSdkIncludeUcrt;$WinSdkIncludeShared;$WinSdkIncludeUm;$WinSdkIncludeWinrt"
}

Write-Host "Environment variables injected successfully! You can now run 'npm run tauri dev' or 'cargo build'." -ForegroundColor Green
