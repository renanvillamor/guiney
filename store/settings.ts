import { create } from 'zustand';

import { openDatabase, repos } from '@/db/client';
import { writeSettings, type AppSettings } from '@/db/settings';

interface SettingsState extends AppSettings {
  ready: boolean;
  /** Opens the database and reads settings. Throws if the database cannot open. */
  load: () => Promise<void>;
  set: (changes: Partial<AppSettings>) => Promise<void>;
}

export const useSettings = create<SettingsState>((set) => ({
  ready: false,
  theme: 'system',
  unitSystem: 'metric',
  syncEnabled: false,
  onboarded: false,
  householdId: '',
  householdName: 'My household',
  inviteCode: null,
  seeded: false,
  pullCursors: {},
  lastSyncedAt: null,

  load: async () => {
    const settings = await openDatabase();
    set({ ...settings, ready: true });
  },

  set: async (changes) => {
    set(changes);
    await writeSettings(repos().db, changes);
  },
}));
