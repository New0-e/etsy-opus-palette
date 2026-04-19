import { useState, useEffect, useCallback } from "react";
import { getPageState, setPageState, subscribePageState } from "./pageStore";

export function usePageState<T extends Record<string, unknown>>(key: string, defaults: T) {
  const [state, setStateRaw] = useState<T>(() => getPageState(key, defaults));

  useEffect(() => {
    // Re-sync on mount in case store changed while component was unmounted
    setStateRaw({ ...getPageState<T>(key, defaults) });
    const unsub = subscribePageState(key, () => {
      setStateRaw({ ...getPageState<T>(key, defaults) });
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const patch = useCallback((update: Partial<T>) => {
    setPageState<T>(key, update);
  }, [key]);

  return [state, patch] as const;
}
