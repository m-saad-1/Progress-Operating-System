@echo off
set PATH=D:\Build Tools For VS\VC\Tools\MSVC\14.44.35207\bin\HostX64\x64;%USERPROFILE%\.cargo\bin;%PATH%
set LIB=D:\Build Tools For VS\VC\Tools\MSVC\14.44.35207\lib\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\um\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\ucrt\x64
set INCLUDE=D:\Build Tools For VS\VC\Tools\MSVC\14.44.35207\include;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\ucrt;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\um;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\shared
rustup default stable-x86_64-pc-windows-msvc
pnpm run start:tauri

