import { useState, useCallback } from "react";

function loadLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

export function useOptionsList(storageKey: string, defaults: string[]) {
  const [added, setAdded] = useState<string[]>(() => loadLS(`opts-added:${storageKey}`, []));
  const [hidden, setHidden] = useState<string[]>(() => loadLS(`opts-hidden:${storageKey}`, []));
  const [customOrder, setCustomOrder] = useState<string[] | null>(() => loadLS(`opts-order:${storageKey}`, null));

  const options = (() => {
    const base = [...defaults.filter(o => !hidden.includes(o)), ...added];
    if (!customOrder) return base;
    const ordered = customOrder.filter(o => base.includes(o));
    const newOnes = base.filter(o => !customOrder.includes(o));
    return [...ordered, ...newOnes];
  })();

  const addOption = useCallback((opt: string) => {
    const v = opt.trim();
    if (!v) return;
    setAdded(prev => {
      if (prev.includes(v) || defaults.includes(v)) return prev;
      const next = [...prev, v];
      localStorage.setItem(`opts-added:${storageKey}`, JSON.stringify(next));
      return next;
    });
  }, [defaults, storageKey]);

  const removeOption = useCallback((opt: string) => {
    if (defaults.includes(opt)) {
      setHidden(prev => {
        if (prev.includes(opt)) return prev;
        const next = [...prev, opt];
        localStorage.setItem(`opts-hidden:${storageKey}`, JSON.stringify(next));
        return next;
      });
    } else {
      setAdded(prev => {
        const next = prev.filter(o => o !== opt);
        localStorage.setItem(`opts-added:${storageKey}`, JSON.stringify(next));
        return next;
      });
    }
  }, [defaults, storageKey]);

  const reorderOptions = useCallback((newOrder: string[]) => {
    setCustomOrder(newOrder);
    localStorage.setItem(`opts-order:${storageKey}`, JSON.stringify(newOrder));
  }, [storageKey]);

  return { options, addOption, removeOption, reorderOptions };
}
