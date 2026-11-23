// Runs the Supabase migration on an in-process Postgres (PGlite) with a stand-in for
// Supabase's auth schema, then checks that households cannot see or touch each other.
//   npm run test:rls
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'supabase/migrations');
const db = new PGlite();

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.uid', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase grants new tables to the API roles by default; the migration must undo that.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
for (const file of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, file), 'utf8'));

const uuid = () => crypto.randomUUID();
const [ana, ben, eve] = [uuid(), uuid(), uuid()];
await db.query('insert into auth.users values ($1), ($2), ($3)', [ana, ben, eve]);

/** Runs SQL the way the API would for this person. */
async function as(user, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.uid', $1, true)", [user ?? '']);
    await tx.exec(`set local role ${user ? 'authenticated' : 'anon'}`);
    return (await tx.query(sql, params)).rows;
  });
}
const denied = (promise, message) => assert.rejects(promise, message);

let checks = 0;
async function check(name, run) {
  await run();
  checks += 1;
  console.log(`  ok  ${name}`);
}

const home = uuid();
const other = uuid();
let code;
const rice = uuid();
const insertItem = (user, id, household, at = '2026-11-24T00:00:00.000Z', quantity = 5) =>
  as(
    user,
    `insert into fridge_items (id, household_id, created_at, updated_at, name, quantity, unit, added_at, source)
     values ($1, $2, $3, $3, 'Rice', $4, 'g', $3, 'manual')
     on conflict (id) do update set
       household_id = excluded.household_id, quantity = excluded.quantity, updated_at = excluded.updated_at`,
    [id, household, at, quantity],
  );

await check('a person can create a household and gets an invite code', async () => {
  const [row] = await as(ana, 'select * from create_household($1, $2)', [home, 'Ana home']);
  assert.match(row.invite_code, /^[0-9A-F]{10}$/);
  code = row.invite_code;
  await as(eve, 'select * from create_household($1, $2)', [other, 'Eve home']);
});
await check('a household id cannot be claimed twice', () =>
  denied(as(eve, 'select * from create_household($1, $2)', [home, 'Stolen'])));
await check('members can write and read their rows', async () => {
  await insertItem(ana, rice, home);
  assert.equal((await as(ana, 'select * from fridge_items')).length, 1);
});
await check('outsiders see nothing', async () => {
  assert.equal((await as(eve, 'select * from fridge_items')).length, 0);
  assert.equal((await as(eve, 'select id from households where id = $1', [home])).length, 0);
  assert.equal((await as(eve, 'select * from household_users where household_id = $1', [home])).length, 0);
});
await check('outsiders cannot insert into another household', () =>
  denied(insertItem(eve, uuid(), home), /row-level security/));
await check('outsiders cannot overwrite a row whose id they know', () =>
  denied(insertItem(eve, rice, other), /row-level security/));
await check('outsiders cannot add themselves to a household', () =>
  denied(as(eve, 'insert into household_users (household_id, user_id) values ($1, $2)', [home, eve]), /permission denied/));
await check('invite codes cannot be read from the table', () =>
  denied(as(ana, 'select invite_code from households'), /permission denied/));
await check('a wrong invite code is refused', () =>
  denied(as(ben, "select * from join_household('NOPE')"), /No household/));
await check('an invite code works, ignoring case and dashes', async () => {
  const typed = `${code.slice(0, 5)}-${code.slice(5)}`.toLowerCase();
  const [row] = await as(ben, 'select * from join_household($1)', [typed]);
  assert.equal(row.id, home);
  assert.equal((await as(ben, 'select * from fridge_items')).length, 1);
  assert.equal((await as(ben, 'select * from my_households()')).length, 1);
});
await check('a newer write wins and a late older write is dropped', async () => {
  const before = (await as(ben, 'select sync_seq from fridge_items'))[0].sync_seq;
  await insertItem(ben, rice, home, '2026-11-24T02:00:00.000Z', 9);
  await insertItem(ana, rice, home, '2026-11-24T01:00:00.000Z', 1);
  const [row] = await as(ana, 'select quantity, sync_seq from fridge_items');
  assert.equal(row.quantity, 9);
  assert.ok(Number(row.sync_seq) > Number(before));
});
await check('a row cannot move to another household', async () => {
  await as(ana, 'select * from create_household($1, $2)', [uuid(), 'Second']);
  const second = (await as(ana, 'select * from my_households()')).find((h) => h.name === 'Second').id;
  await denied(insertItem(ana, rice, second, '2026-11-25T00:00:00.000Z'), /cannot move/);
});
await check('rows cannot be hard deleted', () =>
  denied(as(ana, 'delete from fridge_items'), /permission denied/));
await check('members can rename, outsiders cannot', async () => {
  await as(ben, "update households set name = 'Renamed' where id = $1", [home]);
  await as(eve, "update households set name = 'Hacked' where id = $1", [home]);
  assert.equal((await as(ana, 'select name from households where id = $1', [home]))[0].name, 'Renamed');
});
await check('only members can rotate the code, and the old one stops working', async () => {
  await denied(as(eve, 'select rotate_invite_code($1)', [home]), /Not a member/);
  await as(ana, 'select rotate_invite_code($1)', [home]);
  await denied(as(eve, 'select * from join_household($1)', [code]), /No household/);
});
await check('someone who leaves loses access', async () => {
  await as(ben, 'delete from household_users where user_id = $1', [ben]);
  assert.equal((await as(ben, 'select * from fridge_items')).length, 0);
});
await check('a person cannot remove someone else', async () => {
  await as(ana, 'delete from household_users where user_id = $1', [eve]);
  assert.equal((await as(eve, 'select * from my_households()')).length, 1);
});
await check('signed-out requests get nothing', async () => {
  await denied(as(null, 'select * from fridge_items'), /permission denied/);
  await denied(as(null, 'select * from join_household($1)', ['X']), /permission denied/);
});
await check('every table in the app has RLS on', async () => {
  const { rows } = await db.query(
    "select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and relkind = 'r' and not relrowsecurity",
  );
  assert.deepEqual(rows, []);
});
await check('server columns match the app schema', async () => {
  const source = readFileSync(join(root, 'db/tables.ts'), 'utf8');
  const block = source.slice(source.indexOf('export const COLUMNS'), source.indexOf('export const SYNC_ORDER'));
  for (const [, table, body] of block.matchAll(/^ {2}(\w+): \{([^}]*)\}/gm)) {
    const wanted = [...body.matchAll(/(\w+): '/g)].map((m) => m[1]);
    const { rows } = await db.query(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = $1",
      [table],
    );
    const have = rows.map((row) => row.column_name);
    for (const column of wanted) assert.ok(have.includes(column), `${table}.${column} missing`);
  }
});

console.log(`\n${checks} checks passed`);
