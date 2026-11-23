import type { BaseRow, NewRow } from '@/types/models';

import type { Sql } from './database';
import {
  BASE_COLUMNS,
  columnsOf,
  decodeRow,
  encode,
  type RawRow,
  type TableName,
  type Tables,
} from './tables';

/** Supplies ids, time and the current household, so tests can control them. */
export interface RowContext {
  newId(): string;
  now(): string;
  householdId(): string;
}

const quote = (column: string) => `"${column}"`;

/** Typed reads and writes for one table. Every write marks the row for sync. */
export class Repository<N extends TableName> {
  constructor(
    readonly table: N,
    private readonly context: RowContext,
  ) {}

  async list(sql: Sql): Promise<Tables[N][]> {
    const rows = await sql.all<RawRow>(
      `SELECT * FROM ${this.table} WHERE deleted_at IS NULL ORDER BY created_at, id`,
    );
    return rows.map((row) => decodeRow(this.table, row));
  }

  async listWhere<K extends keyof Tables[N] & string>(
    sql: Sql,
    column: K,
    value: Tables[N][K],
  ): Promise<Tables[N][]> {
    const rows = await sql.all<RawRow>(
      `SELECT * FROM ${this.table} WHERE deleted_at IS NULL AND ${quote(column)} = ? ORDER BY created_at, id`,
      [encode(this.table, column, value)],
    );
    return rows.map((row) => decodeRow(this.table, row));
  }

  async insert(
    sql: Sql,
    values: NewRow<Tables[N]>,
    stamp: string = this.context.now(),
  ): Promise<Tables[N]> {
    const row = {
      ...values,
      id: values.id ?? this.context.newId(),
      household_id: this.context.householdId(),
      created_at: stamp,
      updated_at: stamp,
      deleted_at: null,
    } as unknown as Tables[N];
    const columns = columnsOf(this.table);
    await sql.run(
      `INSERT INTO ${this.table} (${columns.map(quote).join(', ')}, dirty)
       VALUES (${columns.map(() => '?').join(', ')}, 1)`,
      columns.map((column) => encode(this.table, column, row[column as keyof Tables[N]])),
    );
    return row;
  }

  async update(
    sql: Sql,
    id: string,
    changes: Partial<Omit<Tables[N], keyof BaseRow>>,
  ): Promise<void> {
    const base: readonly string[] = BASE_COLUMNS;
    const columns = Object.keys(changes).filter(
      (column) => !base.includes(column) && changes[column as keyof typeof changes] !== undefined,
    );
    const assignments = [...columns.map((column) => `${quote(column)} = ?`), 'updated_at = ?', 'dirty = 1'];
    await sql.run(
      `UPDATE ${this.table} SET ${assignments.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      [
        ...columns.map((column) =>
          encode(this.table, column, changes[column as keyof typeof changes]),
        ),
        this.context.now(),
        id,
      ],
    );
  }

  async softDelete(sql: Sql, id: string): Promise<void> {
    const now = this.context.now();
    await sql.run(
      `UPDATE ${this.table} SET deleted_at = ?, updated_at = ?, dirty = 1
       WHERE id = ? AND deleted_at IS NULL`,
      [now, now, id],
    );
  }

  async softDeleteWhere<K extends keyof Tables[N] & string>(
    sql: Sql,
    column: K,
    value: Tables[N][K],
  ): Promise<void> {
    const now = this.context.now();
    await sql.run(
      `UPDATE ${this.table} SET deleted_at = ?, updated_at = ?, dirty = 1
       WHERE ${quote(column)} = ? AND deleted_at IS NULL`,
      [now, now, encode(this.table, column, value)],
    );
  }
}
