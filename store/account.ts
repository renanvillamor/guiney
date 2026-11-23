import type { Session } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { observeStamp, repos, rowContext, setHouseholdId } from '@/db/client';
import {
  createHousehold,
  isSupabaseConfigured,
  joinHousehold,
  myHouseholds,
  renameHousehold,
  rotateInviteCode,
  supabase,
  supabaseRemote,
  type RemoteHousehold,
} from '@/lib/supabase';
import { moveToHousehold, syncOnce } from '@/lib/sync';

import { loadAllStores } from './index';
import { useSettings } from './settings';

type SyncStatus = 'idle' | 'syncing' | 'error';

interface AccountState {
  session: Session | null;
  status: SyncStatus;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** True when the account is ready; false when the email must be confirmed first. */
  signUp: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  /** Households this account already belongs to. */
  households: () => Promise<RemoteHousehold[]>;
  /** Puts this device's household online. */
  create: (name: string) => Promise<void>;
  joinByCode: (code: string, keepMine: boolean) => Promise<void>;
  connect: (household: RemoteHousehold, keepMine: boolean) => Promise<void>;
  rename: (name: string) => Promise<void>;
  newInviteCode: () => Promise<void>;
  sync: () => Promise<void>;
}

export function messageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    if (/network request failed|failed to fetch/i.test(error.message)) {
      return 'No connection. Check the internet and try again.';
    }
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

let running: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function canSync(): boolean {
  const { syncEnabled, inviteCode } = useSettings.getState();
  return syncEnabled && inviteCode !== null && useAccount.getState().session !== null;
}

/** One sync at a time; callers share the one in flight. */
function runSync(): Promise<void> {
  running ??= (async () => {
    useAccount.setState({ status: 'syncing', error: null });
    try {
      const result = await syncOnce(
        repos().db,
        supabaseRemote,
        useSettings.getState().householdId,
      );
      if (result.newestStamp) observeStamp(result.newestStamp);
      useSettings.setState({ lastSyncedAt: new Date().toISOString() });
      if (result.pulled > 0) await loadAllStores();
      useAccount.setState({ status: 'idle' });
    } catch (error) {
      useAccount.setState({ status: 'error', error: messageOf(error) });
    } finally {
      running = null;
    }
  })();
  return running;
}

function scheduleSync(delayMs: number): void {
  if (!canSync()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (canSync()) void runSync();
  }, delayMs);
}

export const useAccount = create<AccountState>((set, get) => ({
  session: null,
  status: 'idle',
  error: null,

  signIn: async (email, password) => {
    const { data, error } = await supabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
    set({ session: data.session });
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase().auth.signUp({ email, password });
    if (error) throw error;
    set({ session: data.session });
    return data.session !== null;
  },

  signOut: async () => {
    await useSettings.getState().set({ syncEnabled: false });
    // Local scope works offline too; other phones stay signed in.
    await supabase().auth.signOut({ scope: 'local' });
    set({ session: null, status: 'idle', error: null });
  },

  households: () => myHouseholds(),

  create: async (name) => {
    const { householdId, set: save } = useSettings.getState();
    const household = await createHousehold(householdId, name);
    await save({
      householdName: household.name,
      inviteCode: household.invite_code,
      syncEnabled: true,
    });
    await get().sync();
  },

  joinByCode: async (code, keepMine) => {
    await get().connect(await joinHousehold(code), keepMine);
  },

  connect: async (household, keepMine) => {
    // Let a running sync finish so it cannot write old rows into the new household.
    await running;
    const settings = useSettings.getState();
    if (household.id === settings.householdId) {
      await settings.set({
        householdName: household.name,
        inviteCode: household.invite_code,
        syncEnabled: true,
      });
    } else {
      await moveToHousehold(
        repos().db,
        { id: household.id, name: household.name, inviteCode: household.invite_code },
        keepMine,
        rowContext.newId,
      );
      setHouseholdId(household.id);
      useSettings.setState({
        householdId: household.id,
        householdName: household.name,
        inviteCode: household.invite_code,
        syncEnabled: true,
        pullCursors: {},
        lastSyncedAt: null,
      });
    }
    await loadAllStores();
    await get().sync();
  },

  rename: async (name) => {
    const { householdId, inviteCode, set: save } = useSettings.getState();
    if (inviteCode !== null && get().session) await renameHousehold(householdId, name);
    await save({ householdName: name });
  },

  newInviteCode: async () => {
    const { householdId, set: save } = useSettings.getState();
    await save({ inviteCode: await rotateInviteCode(householdId) });
  },

  sync: async () => {
    if (canSync()) await runSync();
  },
}));

/** Call once after the database opens. Does nothing when Supabase is not set up. */
export function startAccount(): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  const client = supabase();

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    useAccount.setState({ session });
    scheduleSync(500);
  });
  const offChange = repos().db.onLocalChange(() => scheduleSync(3000));
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void client.auth.startAutoRefresh();
      scheduleSync(500);
    } else {
      void client.auth.stopAutoRefresh();
    }
  });

  return () => {
    data.subscription.unsubscribe();
    offChange();
    appState.remove();
  };
}
