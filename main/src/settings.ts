import { app } from 'electron';
import fs from 'fs-extra';
import path from 'path';

export interface SettingsSnapshot {
  version: number;
  settingsBackup?: Record<string, unknown>;
  userProfile?: Record<string, unknown>;
  themePreference?: 'light' | 'dark' | 'system';
}

const SETTINGS_SNAPSHOT_VERSION = 1;

function getSettingsSnapshotPath(): string {
  return path.join(app.getPath('userData'), 'settings-snapshot.json');
}

export async function readSettingsSnapshot(): Promise<SettingsSnapshot | null> {
  const snapshotPath = getSettingsSnapshotPath();

  try {
    if (!(await fs.pathExists(snapshotPath))) {
      return null;
    }

    const parsed = await fs.readJson(snapshotPath);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      version:
        typeof parsed.version === 'number' && Number.isFinite(parsed.version)
          ? parsed.version
          : SETTINGS_SNAPSHOT_VERSION,
      settingsBackup:
        parsed.settingsBackup && typeof parsed.settingsBackup === 'object'
          ? parsed.settingsBackup
          : undefined,
      userProfile:
        parsed.userProfile && typeof parsed.userProfile === 'object'
          ? parsed.userProfile
          : undefined,
      themePreference:
        parsed.themePreference === 'dark' ||
        parsed.themePreference === 'light' ||
        parsed.themePreference === 'system'
          ? parsed.themePreference
          : undefined,
    };
  } catch (error) {
    console.warn('Failed to read settings snapshot:', error);
    return null;
  }
}

export async function writeSettingsSnapshot(snapshot: SettingsSnapshot): Promise<void> {
  const snapshotPath = getSettingsSnapshotPath();
  const tempPath = `${snapshotPath}.tmp`;

  const normalized: SettingsSnapshot = {
    version: SETTINGS_SNAPSHOT_VERSION,
    settingsBackup:
      snapshot.settingsBackup && typeof snapshot.settingsBackup === 'object'
        ? snapshot.settingsBackup
        : undefined,
    userProfile:
      snapshot.userProfile && typeof snapshot.userProfile === 'object'
        ? snapshot.userProfile
        : undefined,
    themePreference:
      snapshot.themePreference === 'dark' ||
      snapshot.themePreference === 'light' ||
      snapshot.themePreference === 'system'
        ? snapshot.themePreference
        : undefined,
  };

  await fs.ensureDir(path.dirname(snapshotPath));
  await fs.writeJson(tempPath, normalized, { spaces: 2 });
  await fs.move(tempPath, snapshotPath, { overwrite: true });
}

export async function clearSettingsSnapshot(): Promise<void> {
  const snapshotPath = getSettingsSnapshotPath();

  try {
    await fs.remove(snapshotPath);
  } catch (error) {
    console.warn('Failed to clear settings snapshot:', error);
  }
}