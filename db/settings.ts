import type { ThemePreference } from '@/theme/ThemeProvider';
import type { UnitSystem } from '@/types/models';

import type { Sql } from './database';

/** Device-local key/value settings. These never sync. */
export interface AppSettings {
  theme: ThemePreference;
  unitSystem: UnitSystem;
  syncEnabled: boolean;
  onboarded: boolean;
  householdId: string;
  householdName: string;
  /** Null until the household exists on the server. */
  inviteCode: string | null;
  seeded: boolean;
  /** Highest server sequence number already pulled, per table. */
  pullCursors: Record<string, number>;
  lastSyncedAt: string | null;
}

export async function readSettings(sql: Sql): Promise<Partial<AppSettings>> {
  const rows = await sql.all<{ key: string; value: string }>('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
}

export async function writeSettings(sql: Sql, changes: Partial<AppSettings>): Promise<void> {
  for (const [key, value] of Object.entries(changes)) {
    await sql.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [key, JSON.stringify(value)],
    );
  }
}
