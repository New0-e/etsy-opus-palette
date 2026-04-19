import { useState, useCallback } from "react";

export type ModelOption = { value: string; label: string; tooltip: string };

export const DEFAULT_MODELS: ModelOption[] = [
  { value: "gemini-2.5-flash-image", label: "Nano Banana", tooltip: "Idéal pour la génération standard. Bon équilibre vitesse/qualité." },
  { value: "gemini-3-pro-image-preview", label: "Nano Banana Pro", tooltip: "Haute qualité pour les rendus détaillés et réalistes." },
  { value: "gemini-3.1-flash-image-preview", label: "Nano Banana 2", tooltip: "Dernière génération. Meilleur choix qualité/vitesse." },
];

function loadLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

export function useModelsList() {
  const [customModels, setCustomModels] = useState<ModelOption[]>(() => loadLS("gen-custom-models", []));
  const [hiddenValues, setHiddenValues] = useState<string[]>(() => loadLS("gen-hidden-models", []));

  const models = [
    ...DEFAULT_MODELS.filter(m => !hiddenValues.includes(m.value)),
    ...customModels,
  ];

  const addModel = useCallback((value: string, label: string, tooltip = "") => {
    const v = value.trim();
    const l = label.trim();
    if (!v || !l) return;
    setCustomModels(prev => {
      if (prev.some(m => m.value === v) || DEFAULT_MODELS.some(m => m.value === v)) return prev;
      const next = [...prev, { value: v, label: l, tooltip }];
      localStorage.setItem("gen-custom-models", JSON.stringify(next));
      return next;
    });
  }, []);

  const removeModel = useCallback((value: string) => {
    if (DEFAULT_MODELS.some(m => m.value === value)) {
      setHiddenValues(prev => {
        if (prev.includes(value)) return prev;
        const next = [...prev, value];
        localStorage.setItem("gen-hidden-models", JSON.stringify(next));
        return next;
      });
    } else {
      setCustomModels(prev => {
        const next = prev.filter(m => m.value !== value);
        localStorage.setItem("gen-custom-models", JSON.stringify(next));
        return next;
      });
    }
  }, []);

  const isCustom = (value: string) => !DEFAULT_MODELS.some(m => m.value === value);

  return { models, addModel, removeModel, isCustom };
}
