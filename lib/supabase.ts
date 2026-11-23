import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from 'expo-sqlite/kv-store';

import type { TableName } from '@/db/tables';

import type { Remote, RemoteRow } from './sync';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False when no project is set up. The app then simply stays offline. */
export const isSupabaseConfigured = url !== '' && anonKey !== '';

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error('Sync is not set up in this build.');
  client ??= createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export interface RemoteHousehold {
  id: string;
  name: string;
  invite_code: string;
}

function firstHousehold(data: unknown): RemoteHousehold {
  const row = (data as RemoteHousehold[] | null)?.[0];
  if (!row) throw new Error('The server did not return a household.');
  return row;
}

export async function createHousehold(id: string, name: string): Promise<RemoteHousehold> {
  const { data, error } = await supabase().rpc('create_household', { p_id: id, p_name: name });
  if (error) throw error;
  return firstHousehold(data);
}

export async function joinHousehold(code: string): Promise<RemoteHousehold> {
  const { data, error } = await supabase().rpc('join_household', { p_code: code });
  if (error) throw error;
  return firstHousehold(data);
}

export async function myHouseholds(): Promise<RemoteHousehold[]> {
  const { data, error } = await supabase().rpc('my_households');
  if (error) throw error;
  return (data as RemoteHousehold[] | null) ?? [];
}

export async function renameHousehold(id: string, name: string): Promise<void> {
  const { error } = await supabase().from('households').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function rotateInviteCode(id: string): Promise<string> {
  const { data, error } = await supabase().rpc('rotate_invite_code', { p_household: id });
  if (error) throw error;
  return String(data);
}

/** The server side of sync. */
export const supabaseRemote: Remote = {
  async push(table: TableName, rows: RemoteRow[]) {
    const { error } = await supabase().from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  },
  async pull(table: TableName, householdId: string, after: number, limit: number) {
    const { data, error } = await supabase()
      .from(table)
      .select('*')
      .eq('household_id', householdId)
      .gt('sync_seq', after)
      .order('sync_seq')
      .limit(limit);
    if (error) throw error;
    return (data as RemoteRow[] | null) ?? [];
  },
};
