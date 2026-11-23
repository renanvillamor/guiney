/**
 * The small slice of expo-sqlite the app uses. Tests run the same repositories
 * against node:sqlite through this interface.
 */
export type SqlValue = string | number | null;

export interface SqlDriver {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
}

/** Runs queries on one connection. Inside `tx`, use the `Sql` handed to you. */
export interface Sql {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
}

export class Database implements Sql {
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();

  constructor(private readonly driver: SqlDriver) {}

  private readonly direct: Sql = {
    run: async (sql, params = []) => {
      await this.driver.runAsync(sql, params);
    },
    all: (sql, params = []) => this.driver.getAllAsync(sql, params),
    first: async <T>(sql: string, params: SqlValue[] = []) =>
      (await this.driver.getAllAsync<T>(sql, params))[0] ?? null,
  };

  /** Work runs one piece at a time, so nothing lands inside someone else's transaction. */
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(work, work);
    this.queue = result.catch(() => undefined);
    return result;
  }

  run(sql: string, params: SqlValue[] = []): Promise<void> {
    return this.enqueue(() => this.direct.run(sql, params));
  }

  all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.enqueue(() => this.direct.all<T>(sql, params));
  }

  first<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    return this.enqueue(() => this.direct.first<T>(sql, params));
  }

  exec(sql: string): Promise<void> {
    return this.enqueue(() => this.driver.execAsync(sql));
  }

  /** All or nothing. Do not call back into this Database from `work`; use its argument. */
  tx<T>(work: (sql: Sql) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      await this.driver.execAsync('BEGIN IMMEDIATE');
      try {
        const result = await work(this.direct);
        await this.driver.execAsync('COMMIT');
        return result;
      } catch (error) {
        await this.driver.execAsync('ROLLBACK');
        throw error;
      }
    });
  }

  /** Called after local edits, so sync can pick them up. Not called for pulled changes. */
  onLocalChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyLocalChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}
