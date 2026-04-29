export type GenHistoryEntry = { id: string; timestamp: number; urls: string[] };

const history: GenHistoryEntry[] = [];
const listeners = new Set<() => void>();

function notify() { listeners.forEach(fn => fn()); }

export function pushGenHistory(urls: string[]) {
  history.unshift({ id: Date.now().toString(), timestamp: Date.now(), urls });
  if (history.length > 20) history.pop();
  notify();
}

export function removeGenHistory(id: string) {
  const idx = history.findIndex(e => e.id === id);
  if (idx !== -1) { history.splice(idx, 1); notify(); }
}

export function clearGenHistory() { history.length = 0; notify(); }

import { useState, useEffect } from "react";

export function useGenHistory() {
  const [entries, setEntries] = useState<GenHistoryEntry[]>([...history]);

  useEffect(() => {
    const sync = () => setEntries([...history]);
    listeners.add(sync);
    return () => { listeners.delete(sync); };
  }, []);

  return { entries, pushGenHistory, removeGenHistory, clearGenHistory };
}
