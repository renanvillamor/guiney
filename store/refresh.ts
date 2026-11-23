/** Lets one store ask another to re-read SQLite without importing it (they would form a cycle). */
type StoreName = 'planner' | 'precooked';

const loaders = new Map<StoreName, () => Promise<void>>();

export function registerStore(name: StoreName, load: () => Promise<void>): void {
  loaders.set(name, load);
}

export async function refresh(...names: StoreName[]): Promise<void> {
  await Promise.all(names.map((name) => loaders.get(name)?.()));
}
