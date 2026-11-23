import type { Database, SqlValue } from '@/db/database';
import { SEED_STAMP } from '@/db/seed';
import { readSettings, writeSettings } from '@/db/settings';
import {
  COLUMNS,
  columnsOf,
  DEVICE_ONLY,
  encode,
  SYNC_ORDER,
  type RawRow,
  type TableName,
} from '@/db/tables';

/**
 * Two-way sync. SQLite is the source of truth on the device: edits are marked
 * dirty, pushed, and other people's edits pulled. The newer updated_at wins,
 * here and in the server trigger.
 */

export type RemoteRow = Record<string, unknown> & { id: string };

export interface Remote {
  /** Insert or update. The server drops rows older than its own. */
  push(table: TableName, rows: RemoteRow[]): Promise<void>;
  /** Rows of the household with sync_seq above `after`, in sync_seq order. */
  pull(table: TableName, householdId: string, after: number, limit: number): Promise<RemoteRow[]>;
}

const PUSH_BATCH = 200;
const PULL_BATCH = 500;
/**
 * Two writers can commit out of sequence order, so each pull looks back a little.
 * Applying a row twice is harmless.
 */
const PULL_OVERLAP = 200;

const TIMESTAMPS = new Set(['created_at', 'updated_at', 'deleted_at', 'added_at', 'bought_at']);

/** Postgres writes +00:00 where JavaScript writes Z; stored timestamps must compare as text. */
export function normalizeTimestamp(value: string): string {
  return new Date(value).toISOString();
}

function sharedColumns(table: TableName): string[] {
  const local = DEVICE_ONLY[table] ?? [];
  return columnsOf(table).filter((column) => !local.includes(column));
}

export function toRemote(table: TableName, raw: RawRow): RemoteRow {
  const kinds = COLUMNS[table] as Record<string, string>;
  const row: Record<string, unknown> = {};
  for (const column of sharedColumns(table)) {
    const value = raw[column] ?? null;
    if (kinds[column] === 'json') row[column] = typeof value === 'string' ? JSON.parse(value) : [];
    else if (kinds[column] === 'boolean') row[column] = value === 1;
    else row[column] = value;
  }
  return row as RemoteRow;
}

function fromRemote(table: TableName, row: RemoteRow): Record<string, SqlValue> {
  const local: Record<string, SqlValue> = {};
  for (const column of sharedColumns(table)) {
    const value = row[column];
    local[column] =
      TIMESTAMPS.has(column) && typeof value === 'string'
        ? normalizeTimestamp(value)
        : encode(table, column, value);
  }
  return local;
}

async function pushTable(db: Database, remote: Remote, table: TableName): Promise<number> {
  let pushed = 0;
  for (;;) {
    const rows = await db.all<RawRow>(
      `SELECT * FROM ${table} WHERE dirty = 1 ORDER BY updated_at, id LIMIT ${PUSH_BATCH}`,
    );
    if (rows.length === 0) return pushed;
    await remote.push(
      table,
      rows.map((row) => toRemote(table, row)),
    );
    await db.tx(async (sql) => {
      for (const row of rows) {
        // Edited again while we were sending: stays dirty for the next round.
        await sql.run(`UPDATE ${table} SET dirty = 0 WHERE id = ? AND updated_at = ?`, [
          row.id ?? null,
          row.updated_at ?? null,
        ]);
      }
    });
    pushed += rows.length;
    if (rows.length < PUSH_BATCH) return pushed;
  }
}

async function applyRows(db: Database, table: TableName, rows: RemoteRow[]): Promise<string[]> {
  const applied: string[] = [];
  await db.tx(async (sql) => {
    for (const row of rows) {
      const local = fromRemote(table, row);
      const mine = await sql.first<{ updated_at: string }>(
        `SELECT updated_at FROM ${table} WHERE id = ?`,
        [row.id],
      );
      const columns = Object.keys(local);
      const values = columns.map((column) => local[column] ?? null);
      if (!mine) {
        await sql.run(
          `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}, dirty)
           VALUES (${columns.map(() => '?').join(', ')}, 0)`,
          values,
        );
      } else if (String(local.updated_at) > mine.updated_at) {
        await sql.run(
          `UPDATE ${table} SET ${columns.map((c) => `"${c}" = ?`).join(', ')}, dirty = 0 WHERE id = ?`,
          [...values, row.id],
        );
      } else {
        continue;
      }
      applied.push(String(local.updated_at));
    }
  });
  return applied;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  /** Newest updated_at received, so the local clock can stay ahead of it. */
  newestStamp: string | null;
}

export async function syncOnce(
  db: Database,
  remote: Remote,
  householdId: string,
): Promise<SyncResult> {
  let pushed = 0;
  for (const table of SYNC_ORDER) pushed += await pushTable(db, remote, table);

  const cursors: Record<string, number> = { ...(await readSettings(db)).pullCursors };
  let pulled = 0;
  let newestStamp: string | null = null;

  for (const table of SYNC_ORDER) {
    const saved = cursors[table] ?? 0;
    let after = Math.max(0, saved - PULL_OVERLAP);
    for (;;) {
      const rows = await remote.pull(table, householdId, after, PULL_BATCH);
      if (rows.length === 0) break;
      for (const stamp of await applyRows(db, table, rows)) {
        pulled += 1;
        if (newestStamp === null || stamp > newestStamp) newestStamp = stamp;
      }
      after = Number(rows[rows.length - 1]?.sync_seq ?? after);
      cursors[table] = Math.max(saved, after);
      if (rows.length < PULL_BATCH) break;
    }
  }
  await writeSettings(db, { pullCursors: cursors, lastSyncedAt: new Date().toISOString() });
  return { pushed, pulled, newestStamp };
}

/** Tables whose rows someone may bring along when joining a household. */
const MOVABLE: TableName[] = [
  'members',
  'recipes',
  'recipe_ingredients',
  'recipe_steps',
  'fridge_items',
  'precooked_meals',
];

/**
 * Points this device at another household. With `keepMine`, the person's own members,
 * recipes, fridge and pre-cooked meals move along as new rows; untouched samples, plans,
 * slots and groceries are replaced by the household's.
 */
export async function moveToHousehold(
  db: Database,
  target: { id: string; name: string; inviteCode: string },
  keepMine: boolean,
  newId: () => string,
): Promise<void> {
  await db.tx(async (sql) => {
    for (const table of SYNC_ORDER) {
      if (!keepMine || !MOVABLE.includes(table)) await sql.run(`DELETE FROM ${table}`);
    }
    if (keepMine) {
      for (const table of MOVABLE) await sql.run(`DELETE FROM ${table} WHERE deleted_at IS NOT NULL`);
      for (const table of ['members', 'recipes', 'fridge_items', 'precooked_meals']) {
        await sql.run(`DELETE FROM ${table} WHERE updated_at = ?`, [SEED_STAMP]);
      }
      for (const table of ['recipe_ingredients', 'recipe_steps']) {
        await sql.run(`DELETE FROM ${table} WHERE recipe_id NOT IN (SELECT id FROM recipes)`);
      }
      await sql.run(
        'UPDATE precooked_meals SET recipe_id = NULL WHERE recipe_id NOT IN (SELECT id FROM recipes)',
      );
      await sql.run(
        'UPDATE recipes SET copied_from_recipe_id = NULL WHERE copied_from_recipe_id NOT IN (SELECT id FROM recipes)',
      );

      // Fresh ids: the old ones may already exist on the server under the old household.
      for (const table of MOVABLE) {
        for (const { id } of await sql.all<{ id: string }>(`SELECT id FROM ${table}`)) {
          const fresh = newId();
          await sql.run(
            `UPDATE ${table} SET id = ?, household_id = ?, dirty = 1 WHERE id = ?`,
            [fresh, target.id, id],
          );
          if (table !== 'recipes') continue;
          for (const child of ['recipe_ingredients', 'recipe_steps', 'precooked_meals']) {
            await sql.run(`UPDATE ${child} SET recipe_id = ? WHERE recipe_id = ?`, [fresh, id]);
          }
          await sql.run(
            'UPDATE recipes SET copied_from_recipe_id = ? WHERE copied_from_recipe_id = ?',
            [fresh, id],
          );
        }
      }
    }
    await writeSettings(sql, {
      householdId: target.id,
      householdName: target.name,
      inviteCode: target.inviteCode,
      pullCursors: {},
      lastSyncedAt: null,
      syncEnabled: true,
    });
  });
}
