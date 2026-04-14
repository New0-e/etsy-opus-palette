// Module-level store: persists page state across React route navigation.
// State lives as long as the browser tab is open.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: Record<string, Record<string, any>> = {};

export function getPageState<T extends Record<string, unknown>>(key: string, defaults: T): T {
  if (!store[key]) store[key] = { ...defaults };
  return store[key] as T;
}

export function setPageState<T extends Record<string, unknown>>(key: string, update: Partial<T>): void {
  store[key] = { ...(store[key] ?? {}), ...update };
}
