const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const lockedNativePath = path.join(
  projectRoot,
  '.webpack',
  'main',
  'native_modules',
  'build',
  'Release',
  'better_sqlite3.node'
);

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
      ...options,
    });

    let output = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, output });
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function releaseWindowsLocks() {
  const projectPathEscaped = projectRoot.replace(/\\/g, '\\\\').replace(/'/g, "''");
  const nativePathEscaped = lockedNativePath.replace(/\\/g, '\\\\').replace(/'/g, "''");

  const psScript = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force",
    `$project = '${projectPathEscaped}'`,
    "$targets = Get-CimInstance Win32_Process | Where-Object {",
    "  $_.Name -eq 'node.exe' -and $_.CommandLine -like ('*' + $project + '*') -and $_.CommandLine -match 'electron-forge|webpack|electron'",
    "}",
    "foreach ($p in $targets) { Stop-Process -Id $p.ProcessId -Force }",
    `if (Test-Path '${nativePathEscaped}') { attrib -R '${nativePathEscaped}' }`,
    "$ok = $false",
    "for ($i = 0; $i -lt 8; $i++) {",
    `  if (-not (Test-Path '${nativePathEscaped}')) { $ok = $true; break }`,
    `  try { Remove-Item -Force '${nativePathEscaped}'; $ok = $true; break } catch { Start-Sleep -Milliseconds 600 }`,
    "}",
    "if (Test-Path '.webpack') {",
    "  try { Remove-Item -Recurse -Force '.webpack' } catch {}",
    "}",
  ].join('\n');

  await runCommand('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript]);
  await sleep(800);
}

function isNativeLockError(output) {
  return (
    output.includes('EPERM: operation not permitted, unlink') &&
    output.includes('better_sqlite3.node')
  );
}

async function runForgeStart() {
  if (process.platform === 'win32') {
    return runCommand('cmd.exe', ['/d', '/s', '/c', 'pnpm exec electron-forge start']);
  }

  return runCommand('pnpm', ['exec', 'electron-forge', 'start']);
}

async function main() {
  const firstRun = await runForgeStart();

  if (firstRun.code === 0) {
    process.exit(0);
  }

  if (process.platform === 'win32' && isNativeLockError(firstRun.output)) {
    console.log('\n[DEV-START] Detected native module lock on better_sqlite3.node. Releasing locks and retrying once...\n');
    await releaseWindowsLocks();

    const secondRun = await runForgeStart();
    process.exit(secondRun.code);
  }

  process.exit(firstRun.code);
}

main().catch((error) => {
  console.error('[DEV-START] Unexpected error:', error);
  process.exit(1);
});
