import { sampleDrafts, seed } from '@/db/seed';
import { readSettings } from '@/db/settings';
import type { TableName } from '@/db/tables';
import { moveToHousehold, syncOnce, toRemote, type Remote, type RemoteRow } from '@/lib/sync';

import { testDatabase } from './helpers';

/** Behaves like the Supabase tables: last write wins, one growing sequence, +00:00 timestamps. */
class FakeServer implements Remote {
  tables = new Map<TableName, Map<string, RemoteRow>>();
  seq = 0;
  pushes = 0;

  async push(table: TableName, rows: RemoteRow[]) {
    const store = this.tables.get(table) ?? new Map<string, RemoteRow>();
    this.tables.set(table, store);
    for (const row of rows) {
      this.pushes += 1;
      const old = store.get(row.id);
      if (old && String(row.updated_at) < String(old.updated_at)) continue;
      store.set(row.id, { ...old, ...row, sync_seq: (this.seq += 1) });
    }
  }

  async pull(table: TableName, householdId: string, after: number, limit: number) {
    return [...(this.tables.get(table)?.values() ?? [])]
      .filter((row) => row.household_id === householdId && Number(row.sync_seq) > after)
      .sort((a, b) => Number(a.sync_seq) - Number(b.sync_seq))
      .slice(0, limit)
      .map((row) => ({ ...row, updated_at: String(row.updated_at).replace('Z', '+00:00') }));
  }
}

const item = { name: 'Rice', quantity: 500, unit: 'g' as const, expiry_date: null, added_at: '2026-11-24T00:00:00.000Z', source: 'manual' as const };

async function twoPhones() {
  const server = new FakeServer();
  const a = await testDatabase({ prefix: 'a' });
  const b = await testDatabase({ prefix: 'b' });
  return { server, a, b, sync: (phone: typeof a) => syncOnce(phone.db, server, 'home') };
}

describe('syncOnce', () => {
  it('carries a full cookbook from one phone to another', async () => {
    const { a, b, sync } = await twoPhones();
    await seed(a.db, a.repos);
    await sync(a);
    await sync(b);
    expect(await b.repos.recipes.list()).toEqual(await a.repos.recipes.list());
    expect(await b.repos.members.list()).toEqual(await a.repos.members.list());
  });

  it('sends nothing the second time', async () => {
    const { server, a, sync } = await twoPhones();
    await seed(a.db, a.repos);
    await sync(a);
    const before = server.pushes;
    expect(await sync(a)).toMatchObject({ pushed: 0, pulled: 0 });
    expect(server.pushes).toBe(before);
  });

  it('carries edits and deletes both ways', async () => {
    const { a, b, sync } = await twoPhones();
    const rice = await a.repos.fridge.add(item);
    await sync(a);
    await sync(b);
    b.state.clock += 1000;
    await b.repos.fridge.update(rice.id, { quantity: 200 });
    await sync(b);
    await sync(a);
    expect((await a.repos.fridge.list())[0]!.quantity).toBe(200);
    a.state.clock += 5000;
    await a.repos.fridge.remove(rice.id);
    await sync(a);
    await sync(b);
    expect(await b.repos.fridge.list()).toEqual([]);
  });

  it('lets the newest edit win whichever phone syncs first', async () => {
    for (const order of ['older first', 'newer first']) {
      const { a, b, sync } = await twoPhones();
      const rice = await a.repos.fridge.add(item);
      await sync(a);
      await sync(b);
      a.state.clock += 1000;
      await a.repos.fridge.update(rice.id, { quantity: 1 });
      b.state.clock += 9000;
      await b.repos.fridge.update(rice.id, { quantity: 2 });
      const [first, second] = order === 'older first' ? [a, b] : [b, a];
      await sync(first);
      await sync(second);
      await sync(first);
      expect((await a.repos.fridge.list())[0]!.quantity).toBe(2);
      expect((await b.repos.fridge.list())[0]!.quantity).toBe(2);
    }
  });

  it('gets an offline edit to a phone that has already synced past it', async () => {
    const { a, b, sync } = await twoPhones();
    const old = await a.repos.fridge.add(item); // stays offline on A
    b.state.clock += 60_000;
    await b.repos.fridge.add({ ...item, name: 'Eggs' });
    await sync(b);
    await sync(a);
    await sync(b);
    expect((await b.repos.fridge.list()).map((i) => i.id)).toContain(old.id);
  });

  it('keeps a row dirty when it is edited during the push', async () => {
    const { server, a, sync } = await twoPhones();
    const rice = await a.repos.fridge.add(item);
    const push = server.push.bind(server);
    let raced = false;
    server.push = async (table, rows) => {
      await push(table, rows);
      if (table === 'fridge_items' && !raced) {
        raced = true;
        await a.repos.fridge.update(rice.id, { quantity: 7 });
      }
    };
    await sync(a);
    await sync(a);
    expect(server.tables.get('fridge_items')!.get(rice.id)!.quantity).toBe(7);
  });

  it('loses nothing when the network fails halfway', async () => {
    const { server, a, b, sync } = await twoPhones();
    await seed(a.db, a.repos);
    const push = server.push.bind(server);
    server.push = async (table, rows) => {
      if (table === 'recipe_steps') throw new Error('offline');
      return push(table, rows);
    };
    await expect(sync(a)).rejects.toThrow('offline');
    server.push = push;
    await sync(a);
    await sync(b);
    expect(await b.repos.recipes.list()).toEqual(await a.repos.recipes.list());
  });

  it('handles more rows than one batch', async () => {
    const { a, b, sync } = await twoPhones();
    for (let i = 0; i < 620; i += 1) await a.repos.fridge.add({ ...item, name: `Item ${i}` });
    await sync(a);
    expect(await sync(b)).toMatchObject({ pulled: 620 });
    expect(await b.repos.fridge.list()).toHaveLength(620);
  });

  it('keeps photos on the phone that took them', async () => {
    const { server, a, b, sync } = await twoPhones();
    const id = await a.repos.recipes.add({ ...sampleDrafts()[0]!, photo_uri: 'file:///a.jpg' });
    await sync(a);
    expect(server.tables.get('recipes')!.get(id)).not.toHaveProperty('photo_uri');
    await sync(b);
    b.state.clock += 5000;
    await b.repos.recipes.update(id, { ...sampleDrafts()[0]!, title: 'Renamed' });
    await sync(b);
    await sync(a);
    expect((await a.repos.recipes.list())[0]).toMatchObject({ title: 'Renamed', photo_uri: 'file:///a.jpg' });
  });

  it('sends real booleans and arrays', () => {
    const row = toRemote('meal_plans', { id: 'p', member_ids: '["a"]' });
    expect(row.member_ids).toEqual(['a']);
    expect(toRemote('grocery_items', { id: 'g', is_bought: 1 }).is_bought).toBe(true);
    expect(row).not.toHaveProperty('dirty');
  });
});

describe('moveToHousehold', () => {
  const target = { id: 'theirs', name: 'The Cruz kitchen', inviteCode: 'ABCDE12345' };
  let n = 0;
  const newId = () => `new-${(n += 1)}`;

  it('brings own data under new ids and leaves samples and plans behind', async () => {
    const phone = await testDatabase();
    const { db, repos } = phone;
    await seed(db, repos);
    const mine = await repos.recipes.add({ ...sampleDrafts()[0]!, title: 'Mine' });
    const copy = await repos.recipes.add({ ...sampleDrafts()[0]!, title: 'Copy', copied_from_recipe_id: mine });
    await repos.precooked.add({ name: 'Mine, cooked', recipe_id: mine, prepared_on: '2026-11-24', expiry_date: null, notes: '' });
    await repos.plans.add({ start_date: '2026-11-23', end_date: '2026-11-29', member_ids: [] });

    await moveToHousehold(db, target, true, newId);

    const recipes = await repos.recipes.list();
    expect(recipes.map((r) => r.title).sort()).toEqual(['Copy', 'Mine']);
    const moved = recipes.find((r) => r.title === 'Mine')!;
    expect(moved.id).not.toBe(mine);
    expect(moved.household_id).toBe('theirs');
    expect(moved.ingredients).toHaveLength(sampleDrafts()[0]!.ingredients.length);
    expect(recipes.find((r) => r.title === 'Copy')).toMatchObject({ copied_from_recipe_id: moved.id });
    expect(recipes.some((r) => r.id === copy)).toBe(false);
    expect((await repos.precooked.list())[0]!.recipe_id).toBe(moved.id);
    expect(await repos.plans.list()).toEqual([]);
    expect(await repos.slots.list()).toEqual([]);
    expect(await repos.members.list()).toEqual([]);
    expect(await readSettings(db)).toMatchObject({ householdId: 'theirs', inviteCode: 'ABCDE12345', pullCursors: {} });
  });

  it('can start clean, then pulls the household', async () => {
    const server = new FakeServer();
    const host = await testDatabase({ householdId: 'theirs', prefix: 'host' });
    await seed(host.db, host.repos);
    await syncOnce(host.db, server, 'theirs');

    const guest = await testDatabase({ prefix: 'guest' });
    await seed(guest.db, guest.repos);
    await moveToHousehold(guest.db, target, false, newId);
    await syncOnce(guest.db, server, 'theirs');
    expect(await guest.repos.recipes.list()).toEqual(await host.repos.recipes.list());
    expect(await guest.repos.slots.list()).toHaveLength(4);
  });
});
