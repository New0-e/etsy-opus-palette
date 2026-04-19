import { useState, useCallback } from "react";

export type Fav<T> = { id: string; name: string; data: T };

function loadLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

export function useFavorites<T>(storageKey: string) {
  const [favs, setFavs] = useState<Fav<T>[]>(() => loadLS(`favs:${storageKey}`, []));

  const saveFav = useCallback((name: string, data: T) => {
    setFavs(prev => {
      const next = [...prev, { id: Date.now().toString(), name, data }];
      localStorage.setItem(`favs:${storageKey}`, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  const removeFav = useCallback((id: string) => {
    setFavs(prev => {
      const next = prev.filter(f => f.id !== id);
      localStorage.setItem(`favs:${storageKey}`, JSON.stringify(next));
      return next;
    });
  }, [storageKey]);

  return { favs, saveFav, removeFav };
}
