@echo off
set "PATH=%PATH%;D:\Build Tools For VS\VC\Tools\MSVC\14.44.35207\bin\HostX64\x64"
set "LIB=C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\um\x64;C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0\ucrt\x64;D:\Build Tools For VS\VC\Tools\MSVC\14.44.35207\lib\x64"
set "INCLUDE=C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\um;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\ucrt;C:\Program Files (x86)\Windows Kits\10\Include\10.0.26100.0\shared;D:\Build Tools For VS\VC\Tools\MSVC\14.44.35207\include"
set CARGO_INCREMENTAL=0
cd src-tauri
cargo build
