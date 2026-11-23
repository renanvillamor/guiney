import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { Database } from './database';
import { migrate } from './migrations';
import { createRepositories, type Repositories } from './repositories';
import type { RowContext } from './repository';
import { seed } from './seed';
import { readSettings, writeSettings, type AppSettings } from './settings';
import { SYNC_ORDER } from './tables';

let householdId = '';
let repositories: Repositories | null = null;

/** Strictly increasing, so two edits in one millisecond still have an order. */
let lastStamp = 0;
function now(): string {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return new Date(lastStamp).toISOString();
}

/**
 * Keeps our clock ahead of every edit we have seen. Without this, editing a row last
 * touched by a phone with a fast clock would look older than it and be dropped.
 */
export function observeStamp(stamp: string): void {
  const time = Date.parse(stamp);
  if (Number.isFinite(time)) lastStamp = Math.max(lastStamp, time);
}

export const rowContext: RowContext = {
  newId: () => Crypto.randomUUID(),
  now,
  householdId: () => householdId,
};

/** Called when this device joins another household. */
export function setHouseholdId(id: string): void {
  householdId = id;
}

/** Everything the stores need. Throws if used before `openDatabase` finishes. */
export function repos(): Repositories {
  if (!repositories) throw new Error('The database is not open yet');
  return repositories;
}

const DEFAULTS: Omit<AppSettings, 'householdId'> = {
  theme: 'system',
  unitSystem: 'metric',
  syncEnabled: false,
  onboarded: false,
  householdName: 'My household',
  inviteCode: null,
  seeded: false,
  pullCursors: {},
  lastSyncedAt: null,
};

let opening: Promise<AppSettings> | null = null;

/** Opens, migrates and (first time) seeds. Safe to call more than once. */
export function openDatabase(): Promise<AppSettings> {
  opening ??= open().catch((error: unknown) => {
    opening = null;
    throw error;
  });
  return opening;
}

async function open(): Promise<AppSettings> {
  const driver = await SQLite.openDatabaseAsync('guiney.db');
  await driver.execAsync('PRAGMA journal_mode = WAL');
  const db = new Database(driver);
  await migrate(db);

  const stored = await readSettings(db);
  const settings: AppSettings = {
    ...DEFAULTS,
    ...stored,
    householdId: stored.householdId ?? Crypto.randomUUID(),
  };
  householdId = settings.householdId;
  if (!stored.householdId) await writeSettings(db, { householdId });

  for (const table of SYNC_ORDER) {
    const row = await db.first<{ newest: string | null }>(
      `SELECT MAX(updated_at) AS newest FROM ${table}`,
    );
    if (row?.newest) observeStamp(row.newest);
  }

  repositories = createRepositories(db, rowContext);
  if (!settings.seeded) await seed(db, repositories);
  return { ...settings, seeded: true };
}
