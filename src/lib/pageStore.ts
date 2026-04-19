// Module-level store: persists page state across React route navigation.
// State lives as long as the browser tab is open.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store: Record<string, Record<string, any>> = {};
const listeners: Record<string, Set<() => void>> = {};

export function getPageState<T extends Record<string, unknown>>(key: string, defaults: T): T {
  if (!store[key]) store[key] = { ...defaults };
  return store[key] as T;
}

export function setPageState<T extends Record<string, unknown>>(key: string, update: Partial<T>): void {
  store[key] = { ...(store[key] ?? {}), ...update };
  listeners[key]?.forEach(fn => fn());
}

export function subscribePageState(key: string, fn: () => void): () => void {
  if (!listeners[key]) listeners[key] = new Set();
  listeners[key].add(fn);
  return () => listeners[key].delete(fn);
}
