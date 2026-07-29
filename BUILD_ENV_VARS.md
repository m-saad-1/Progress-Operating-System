# Windows MSVC Build Tools and SDK Locations
This file was generated to document the dispersed locations of the MSVC Build Tools and Windows 10 SDK on this machine. Agents or developers should use these paths when setting up the environment to compile native dependencies (like Rust/Tauri).

## MSVC Toolchain
**Location:** `D:\Build Tools For VS\VC\Tools\MSVC\14.44.35207`
- **Linker / Binaries (x64):** `D:\Build Tools For VS\VC\Tools\MSVC\14.44.35207\bin\HostX64\x64`
- **Libraries (x64):** `D:\Build Tools For VS\VC\Tools\MSVC\14.44.35207\lib\x64`
- **Headers:** `D:\Build Tools For VS\VC\Tools\MSVC\14.44.35207\include`

## Windows 10 SDK (Version 10.0.26100.0)
**Location:** `C:\Program Files (x86)\Windows Kits\10`
- **Libraries (x64 um):** `C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\um\x64`
- **Libraries (x64 ucrt):** `C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\ucrt\x64`
- **Headers (um):** `C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\um`
- **Headers (ucrt):** `C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\ucrt`
- **Headers (shared):** `C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\shared`

## Usage
To quickly inject these into your current terminal session so that `npm run tauri dev` works without error, a PowerShell script has been provided at the root of the project:
`.\set-build-env.ps1`

Run this script before compiling Tauri or Rust code.
