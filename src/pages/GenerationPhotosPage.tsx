import { useState, useCallback, useEffect } from "react";
import { driveStore } from "@/lib/driveStore";
import { useGenHistory, pushGenHistory } from "@/lib/useGenHistory";
import { usePageState } from "@/lib/usePageState";
import { useOptionsList } from "@/lib/useOptionsList";
import { useFavorites } from "@/lib/useFavorites";
import { useModelsList } from "@/lib/useModelsList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles, Upload, X, Check, Download, FlaskConical, ChevronLeft, ChevronRight, ZoomIn, Plus, Star, Trash2, Settings, History, RotateCcw, Terminal, Copy, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/edc44347-0c53-473e-8047-956afd36b4f4";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/edc44347-0c53-473e-8047-956afd36b4f4";

async function compressImage(file: File, maxPx = 1500, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(new File([blob!], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })),
        "image/jpeg", quality
      );
    };
    img.src = url;
  });
}

const DEFAULT_ENVIRONMENTS = [
  "Studio minimaliste fond blanc", "Studio marbre luxueux", "Salon bohème",
  "Cuisine moderne ensoleillée", "Chambre cocooning", "Salle de bain luxueuse",
  "Bureau scandinave", "Terrasse café parisien", "Jardin verdoyant",
  "Flat lay table bois rustique", "Flat lay draps lin froissé",
];
const DEFAULT_ECLAIRAGES = [
  "Heure dorée lumière chaude", "Lumière naturelle fenêtre",
  "Studio Softbox pro", "Cinématique sombre contrasté",
];
const DEFAULT_ANGLES = [
  "Macro gros plan détails", "Vue à hauteur des yeux",
  "Vue du dessus 90 degrés", "Trois quarts dynamique",
];
const DEFAULT_ACCESSOIRES = [
  "Plantes Monstera et Eucalyptus", "Livres et tasse de café fumante",
  "Tissus soie et pétales de fleurs", "Miroirs vintage et gouttes d'eau",
  "Clavier mécanique et plante grasse", "Tapis moelleux",
  "Nourriture et ingrédients cuisine",
];

const trPhotos: Record<string, string> = {
  // Environnements
  "Studio minimaliste fond blanc": "minimalist white background studio",
  "Studio marbre luxueux": "luxurious marble studio",
  "Salon bohème": "bohemian living room",
  "Cuisine moderne ensoleillée": "sunny modern kitchen",
  "Chambre cocooning": "cozy bedroom",
  "Salle de bain luxueuse": "luxurious bathroom",
  "Bureau scandinave": "Scandinavian office",
  "Terrasse café parisien": "Parisian café terrace",
  "Jardin verdoyant": "lush green garden",
  "Flat lay table bois rustique": "flat lay rustic wood table",
  "Flat lay draps lin froissé": "flat lay wrinkled linen sheets",
  // Éclairages
  "Heure dorée lumière chaude": "golden hour warm light",
  "Lumière naturelle fenêtre": "natural window light",
  "Studio Softbox pro": "professional studio softbox lighting",
  "Cinématique sombre contrasté": "cinematic moody contrast lighting",
  // Angles
  "Macro gros plan détails": "macro close-up details",
  "Vue à hauteur des yeux": "eye-level standard view",
  "Vue du dessus 90 degrés": "top-down flat lay 90 degrees",
  "Trois quarts dynamique": "three-quarters dynamic angle",
  // Accessoires
  "Plantes Monstera et Eucalyptus": "Monstera and eucalyptus plants",
  "Livres et tasse de café fumante": "books and steaming coffee cup",
  "Tissus soie et pétales de fleurs": "silk fabrics and flower petals",
  "Miroirs vintage et gouttes d'eau": "vintage mirrors and water droplets",
  "Clavier mécanique et plante grasse": "mechanical keyboard and succulent plant",
  "Tapis moelleux": "soft fluffy rug",
  "Nourriture et ingrédients cuisine": "food and kitchen ingredients",
};

type PhotosFav = {
  categorie: string;
  env: string[];
  ecl: string[];
  angle: string[];
  acc: string[];
};

function DropZone({ label, files, onFiles }: { label: string; files: File[]; onFiles: (f: File[]) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const urls = files.map((f) => URL.createObjectURL(f));

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const driveId = e.dataTransfer.getData("drive-item-id");
    const driveName = e.dataTransfer.getData("drive-item-name");
    if (driveId) {
      const f = await driveStore.fetchAsFile(driveId, driveName);
      if (f) onFiles([...files, f]);
      return;
    }
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    onFiles([...files, ...dropped]);
  }, [files, onFiles]);

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) onFiles([...files, ...Array.from(e.target.files)]);
  };

  useEffect(() => {
    if (previewIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setPreviewIndex((i) => i !== null ? Math.min(i + 1, files.length - 1) : null);
      if (e.key === "ArrowLeft") setPreviewIndex((i) => i !== null ? Math.max(i - 1, 0) : null);
      if (e.key === "Escape") setPreviewIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewIndex, files.length]);

  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={`dropzone ${dragOver ? "dropzone-active" : ""}`}
      >
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Glissez vos images ici ou cliquez</p>
        <input type="file" accept="image/*" multiple className="hidden" id={`file-${label}`} onChange={onInput} />
        <label htmlFor={`file-${label}`} className="text-xs text-primary cursor-pointer hover:underline">Parcourir</label>
      </div>
      {files.length > 0 && (
        <div className="flex gap-2 mt-2 flex-wrap">
          {files.map((f, i) => (
            <div key={i} className="relative group">
              <img
                src={urls[i]}
                className="h-16 w-16 rounded-md object-cover border border-border cursor-pointer"
                onClick={() => setPreviewIndex(i)}
              />
              <button
                onClick={(e) => { e.stopPropagation(); onFiles(files.filter((_, j) => j !== i)); }}
                className="absolute -top-1 -right-1 bg-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <X className="h-3 w-3 text-destructive-foreground" />
              </button>
              <div
                onClick={() => setPreviewIndex(i)}
                className="absolute inset-0 flex items-center justify-center rounded-md bg-black/0 group-hover:bg-black/30 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                <ZoomIn className="h-5 w-5 text-white drop-shadow" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox aperçu */}
      {previewIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setPreviewIndex(null)}>
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewIndex(null); }}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          {files.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewIndex((i) => i !== null ? Math.max(i - 1, 0) : null); }}
              disabled={previewIndex === 0}
              className="absolute left-4 bg-white/10 hover:bg-white/20 disabled:opacity-20 rounded-full p-3 transition-colors"
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
          )}
          <img
            src={urls[previewIndex]}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
          {files.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setPreviewIndex((i) => i !== null ? Math.min(i + 1, files.length - 1) : null); }}
              disabled={previewIndex === files.length - 1}
              className="absolute right-4 bg-white/10 hover:bg-white/20 disabled:opacity-20 rounded-full p-3 transition-colors"
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </button>
          )}
          <div className="absolute bottom-4 text-white/60 text-sm">
            {files[previewIndex].name} — {previewIndex + 1} / {files.length}
          </div>
        </div>
      )}
    </div>
  );
}

function MultiSelect({ label, options, selected, onChange, onAdd, onRemove, onReorder, editMode }: {
  label: string; options: string[]; selected: string[]; onChange: (s: string[]) => void;
  onAdd: (fr: string, en: string) => void; onRemove: (opt: string) => void;
  onReorder: (newOrder: string[]) => void; editMode: boolean;
}) {
  const [inputFr, setInputFr] = useState("");
  const [inputEn, setInputEn] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };

  const handleRemove = (opt: string) => {
    onRemove(opt);
    if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
  };

  const handleAdd = () => {
    const fr = inputFr.trim();
    if (!fr) return;
    onAdd(fr, inputEn.trim());
    if (!selected.includes(fr)) onChange([...selected, fr]);
    setInputFr("");
    setInputEn("");
  };

  const handleDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === i) { setDragIndex(null); setDragOverIndex(null); return; }
    const next = [...options];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(i, 0, moved);
    onReorder(next);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt, i) => (
          <div
            key={opt}
            className={`relative flex items-center transition-opacity ${editMode && dragIndex === i ? "opacity-40" : ""} ${editMode && dragOverIndex === i && dragIndex !== i ? "ring-2 ring-primary rounded-full" : ""}`}
            draggable={editMode}
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => { if (!editMode) return; e.preventDefault(); setDragOverIndex(i); }}
            onDrop={(e) => handleDrop(e, i)}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
          >
            <button type="button" onClick={() => !editMode && toggle(opt)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-all ${editMode ? "pr-6 cursor-grab active:cursor-grabbing" : ""} ${
                selected.includes(opt)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-secondary-foreground border-border hover:border-muted-foreground"
              }`}
            >
              {opt}
            </button>
            {editMode && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(opt); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {editMode && (
        <div className="flex gap-2">
          <Input
            placeholder="Option (FR)..."
            value={inputFr}
            onChange={(e) => setInputFr(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            className="text-sm"
          />
          <Input
            placeholder="English..."
            value={inputEn}
            onChange={(e) => setInputEn(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            className="text-sm"
          />
          <Button type="button" variant="outline" size="icon" onClick={handleAdd} className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

type PhotosPageState = { loading: boolean; results: string[] };
const photosDefaults: PhotosPageState = { loading: false, results: [] };

export default function GenerationPhotosPage() {
  const [psState, psPatch] = usePageState<PhotosPageState>("generation-photos", photosDefaults);
  const [mode, setMode] = useState<"auto" | "manuel">("auto");
  const [productImages, setProductImages] = useState<File[]>([]);
  const [bgImages, setBgImages] = useState<File[]>([]);
  const [modelImages, setModelImages] = useState<File[]>([]);
  const [categorie, setCategorie] = useState("");
  const [selectedEnv, setSelectedEnv] = useState<string[]>([]);
  const [selectedEcl, setSelectedEcl] = useState<string[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<string[]>([]);
  const [selectedAcc, setSelectedAcc] = useState<string[]>([]);
  const [instructions, setInstructions] = useState("");
  const [imageCount, setImageCount] = useState("3");
  const [generationModel, setGenerationModel] = useState("gemini-2.5-flash-image");
  const loading = psState.loading;
  const results = psState.results;
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [testMode, setTestMode] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [n8nLog, setN8nLog] = useState<{ status: number; ok: boolean; raw: string; ts: string } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const { entries: historyEntries, removeGenHistory, clearGenHistory } = useGenHistory();

  // Option lists avec persistance
  const envList = useOptionsList("gen-photos-env", DEFAULT_ENVIRONMENTS);
  const eclList = useOptionsList("gen-photos-ecl", DEFAULT_ECLAIRAGES);
  const angleList = useOptionsList("gen-photos-angle", DEFAULT_ANGLES);
  const accList = useOptionsList("gen-photos-acc", DEFAULT_ACCESSOIRES);

  // Traductions custom (options ajoutées par l'utilisateur)
  const [customTr, setCustomTr] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("photos-custom-tr") ?? "{}"); } catch { return {}; }
  });
  const addCustomTr = (fr: string, en: string) => {
    if (!en) return;
    setCustomTr(prev => {
      const next = { ...prev, [fr]: en };
      localStorage.setItem("photos-custom-tr", JSON.stringify(next));
      return next;
    });
  };
  const tAll = (v: string) => customTr[v] ?? trPhotos[v] ?? v;

  // Favoris / presets de sélection
  const { favs: photoFavs, saveFav: savePhotoFav, removeFav: removePhotoFav } = useFavorites<PhotosFav>("gen-photos");
  const [savingFav, setSavingFav] = useState(false);
  const [favName, setFavName] = useState("");

  // Gestion des modèles IA
  const { models, addModel, removeModel, isCustom } = useModelsList();
  const [showModelEdit, setShowModelEdit] = useState(false);
  const [editOptions, setEditOptions] = useState(false);
  const [newModelValue, setNewModelValue] = useState("");
  const [newModelLabel, setNewModelLabel] = useState("");

  // Si le modèle sélectionné n'existe plus dans la liste, prendre le premier disponible
  useEffect(() => {
    if (models.length > 0 && !models.some(m => m.value === generationModel)) {
      setGenerationModel(models[0].value);
    }
  }, [models, generationModel]);

  const handleSaveFav = () => {
    const name = favName.trim();
    if (!name) return;
    savePhotoFav(name, { categorie, env: selectedEnv, ecl: selectedEcl, angle: selectedAngle, acc: selectedAcc });
    setFavName("");
    setSavingFav(false);
    toast.success("Favori enregistré !");
  };

  const applyFav = (data: PhotosFav) => {
    setCategorie(data.categorie);
    setSelectedEnv(data.env);
    setSelectedEcl(data.ecl);
    setSelectedAngle(data.angle);
    setSelectedAcc(data.acc);
  };

  const downloadImage = useCallback((url: string, index: number) => {
    const ext = url.startsWith("data:image/png") ? "png" : "jpg";
    const a = document.createElement("a");
    a.href = url;
    a.download = `generated-${index + 1}.${ext}`;
    a.click();
  }, []);

  const downloadSelected = useCallback(() => {
    selectedResults.forEach((url, i) => {
      setTimeout(() => downloadImage(url, results.indexOf(url)), i * 150);
    });
  }, [selectedResults, results, downloadImage]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setLightboxIndex((i) => i !== null ? Math.min(i + 1, results.length - 1) : null);
      if (e.key === "ArrowLeft") setLightboxIndex((i) => i !== null ? Math.max(i - 1, 0) : null);
      if (e.key === "Escape") setLightboxIndex(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, results.length]);

  const handleGenerate = useCallback(async (currentMode: "auto" | "manuel" = mode) => {
    if (productImages.length === 0) { toast.error("Ajoutez au moins une image produit"); return; }
    psPatch({ loading: true, results: [] });
    try {
      const [compressedProducts, compressedBg, compressedModels] = await Promise.all([
        Promise.all(productImages.map((f) => compressImage(f))),
        Promise.all(bgImages.map((f) => compressImage(f))),
        Promise.all(modelImages.map((f) => compressImage(f))),
      ]);
      const formData = new FormData();
      compressedProducts.forEach((f) => formData.append("product_images", f));
      compressedBg.forEach((f) => formData.append("bg_images", f));
      compressedModels.forEach((f) => formData.append("model_images", f));
      formData.append("mode", currentMode);
      formData.append("image_count", imageCount);
      formData.append("generation_model", generationModel);
      if (instructions) formData.append("instructions", instructions);
      if (currentMode === "manuel") {
        if (categorie) formData.append("categorie", categorie);
        if (selectedEnv.length) formData.append("environnement", selectedEnv.map(tAll).join(", "));
        if (selectedEcl.length) formData.append("eclairage", selectedEcl.map(tAll).join(", "));
        if (selectedAngle.length) formData.append("angle", selectedAngle.map(tAll).join(", "));
        if (selectedAcc.length) formData.append("accessoires", selectedAcc.map(tAll).join(", "));
      }

      const res = await fetch(testMode ? WEBHOOK_TEST : WEBHOOK_PROD, {
        method: "POST",
        body: formData,
      });

      const rawText = await res.text();
      setN8nLog({ status: res.status, ok: res.ok, raw: rawText, ts: new Date().toLocaleTimeString() });
      setLogOpen(!res.ok);

      if (!res.ok) {
        if (res.status === 413) { toast.error("Images trop lourdes — réduisez leur taille"); return; }
        if (res.status === 404) { toast.error("Webhook introuvable — en mode test, lancez d'abord un test dans n8n"); return; }
        toast.error(`Erreur ${res.status}`);
        return;
      }

      const text = rawText;
      try {
        const json = JSON.parse(text);
        const arr = Array.isArray(json) ? json : [json];

        const cleanB64 = (s: string) => s.replace(/\s+/g, "").replace(/^data:[^,]+,/, "");

        const toDataUrl = (item: any): string | null => {
          if (item?.binary?.data?.data) {
            const mime = item.binary.data.mimeType ?? "image/png";
            return `data:${mime};base64,${cleanB64(item.binary.data.data)}`;
          }
          if (item?.binary) {
            for (const key of Object.keys(item.binary)) {
              const b = item.binary[key];
              if (b?.data) return `data:${b.mimeType ?? "image/png"};base64,${cleanB64(b.data)}`;
            }
          }
          if (item?.data && item?.mimeType) return `data:${item.mimeType};base64,${cleanB64(item.data)}`;
          if (item?.b64_json) return `data:image/jpeg;base64,${cleanB64(item.b64_json)}`;
          if (item?.base64) return `data:image/jpeg;base64,${cleanB64(item.base64)}`;
          if (item?.image && !item.image.startsWith("http")) return `data:image/jpeg;base64,${cleanB64(item.image)}`;
          return null;
        };

        const urls = arr.flatMap((item: any) => {
          const directUrls: string[] = (item.image_urls ?? item.urls ?? (item.url ? [item.url] : []));
          if (directUrls.length) return directUrls;
          const b64 = toDataUrl(item);
          if (b64) return [b64];
          if (Array.isArray(item.images)) return item.images.map(toDataUrl).filter(Boolean);
          return [];
        }).filter(Boolean);

        if (urls.length) { psPatch({ results: urls }); pushGenHistory(urls); toast.success("Génération terminée !"); }
        else { toast.success("Workflow lancé — les images seront disponibles sous peu."); }
      } catch {
        toast.success("Workflow lancé !");
      }
    } catch {
      toast.error("Erreur de connexion au workflow");
    } finally {
      psPatch({ loading: false });
    }
  }, [mode, productImages, bgImages, modelImages, imageCount, instructions, categorie, selectedEnv, selectedEcl, selectedAngle, selectedAcc, testMode, generationModel, psPatch]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Gen Images</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={`relative flex items-center gap-1.5 text-sm transition-colors ${showHistory ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <History className="h-4 w-4" />
            <span>Historique</span>
            {historyEntries.length > 0 && (
              <span className="absolute -top-1.5 -right-2 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-medium">
                {historyEntries.length > 9 ? "9+" : historyEntries.length}
              </span>
            )}
          </button>
          <div className="flex items-center gap-2">
            <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
            <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>Mode test</span>
            <Switch checked={testMode} onCheckedChange={setTestMode} />
          </div>
        </div>
      </div>

      {/* Historique panel */}
      {showHistory && (
        <div className="tool-card mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Historique de la session</span>
            </div>
            {historyEntries.length > 0 && (
              <button
                type="button"
                onClick={clearGenHistory}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                Tout effacer
              </button>
            )}
          </div>
          {historyEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune génération dans cette session.</p>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {historyEntries.map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border bg-secondary/10 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      {" — "}
                      {entry.urls.length} image{entry.urls.length > 1 ? "s" : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { psPatch({ results: entry.urls }); setShowHistory(false); toast.success("Résultats restaurés !"); }}
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        title="Restaurer ces résultats"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restaurer
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGenHistory(entry.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Supprimer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {entry.urls.slice(0, 8).map((url, i) => (
                      <div key={i} className="relative group/h">
                        <img src={url} className="w-full aspect-square object-cover rounded cursor-pointer" onClick={() => { psPatch({ results: entry.urls }); setLightboxIndex(i); setShowHistory(false); }} />
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadImage(url, i); }}
                          className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5 opacity-0 group-hover/h:opacity-100 transition-all hover:bg-black/80"
                        >
                          <Download className="h-2.5 w-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                    {entry.urls.length > 8 && (
                      <div className="aspect-square rounded bg-secondary flex items-center justify-center text-xs text-muted-foreground">
                        +{entry.urls.length - 8}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="tool-card space-y-6">
        {/* Mode Toggle */}
        <div className="flex items-center gap-3">
          <Label>Mode :</Label>
          <span className={`text-sm ${mode === "auto" ? "text-primary" : "text-muted-foreground"}`}>Auto</span>
          <Switch checked={mode === "manuel"} onCheckedChange={(v) => setMode(v ? "manuel" : "auto")} />
          <span className={`text-sm ${mode === "manuel" ? "text-primary" : "text-muted-foreground"}`}>Manuel</span>
        </div>

        {/* Drop zones */}
        <DropZone label="Images produit à transformer *" files={productImages} onFiles={setProductImages} />
        <DropZone label="Image de fond (optionnel)" files={bgImages} onFiles={setBgImages} />
        <DropZone label="Image modèle (optionnel)" files={modelImages} onFiles={setModelImages} />

        {mode === "manuel" && (
          <>
            {/* Favoris */}
            <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-sm font-medium">Favoris</span>
                </div>
                {!savingFav ? (
                  <button
                    type="button"
                    onClick={() => setSavingFav(true)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    Enregistrer la sélection
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      value={favName}
                      onChange={(e) => setFavName(e.target.value)}
                      placeholder="Nom du favori..."
                      className="h-7 text-xs w-36"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveFav();
                        if (e.key === "Escape") { setSavingFav(false); setFavName(""); }
                      }}
                    />
                    <Button type="button" size="sm" className="h-7 text-xs px-2" onClick={handleSaveFav}>OK</Button>
                    <button type="button" onClick={() => { setSavingFav(false); setFavName(""); }} className="text-muted-foreground hover:text-foreground transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {photoFavs.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun favori — sélectionnez des options et enregistrez.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {photoFavs.map((fav) => (
                    <div key={fav.id} className="relative group/fav">
                      <button
                        type="button"
                        onClick={() => applyFav(fav.data)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 text-amber-600 dark:text-amber-300 transition-all pr-6"
                      >
                        <Star className="h-2.5 w-2.5" />
                        {fav.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePhotoFav(fav.id)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/fav:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Ex: Bijoux, Décoration..." />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setEditOptions(!editOptions)}
                className={`text-xs flex items-center gap-1 transition-colors ${editOptions ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Settings className="h-3 w-3" />
                {editOptions ? "Terminer" : "Modifier les options"}
              </button>
            </div>

            <MultiSelect
              label="Environnement"
              options={envList.options}
              selected={selectedEnv}
              onChange={setSelectedEnv}
              onAdd={(fr, en) => { envList.addOption(fr); addCustomTr(fr, en); }}
              onRemove={(opt) => { envList.removeOption(opt); setSelectedEnv(p => p.filter(s => s !== opt)); }}
              onReorder={envList.reorderOptions}
              editMode={editOptions}
            />
            <MultiSelect
              label="Éclairage"
              options={eclList.options}
              selected={selectedEcl}
              onChange={setSelectedEcl}
              onAdd={(fr, en) => { eclList.addOption(fr); addCustomTr(fr, en); }}
              onRemove={(opt) => { eclList.removeOption(opt); setSelectedEcl(p => p.filter(s => s !== opt)); }}
              onReorder={eclList.reorderOptions}
              editMode={editOptions}
            />
            <MultiSelect
              label="Angle de vue"
              options={angleList.options}
              selected={selectedAngle}
              onChange={setSelectedAngle}
              onAdd={(fr, en) => { angleList.addOption(fr); addCustomTr(fr, en); }}
              onRemove={(opt) => { angleList.removeOption(opt); setSelectedAngle(p => p.filter(s => s !== opt)); }}
              onReorder={angleList.reorderOptions}
              editMode={editOptions}
            />
            <MultiSelect
              label="Accessoires"
              options={accList.options}
              selected={selectedAcc}
              onChange={setSelectedAcc}
              onAdd={(fr, en) => { accList.addOption(fr); addCustomTr(fr, en); }}
              onRemove={(opt) => { accList.removeOption(opt); setSelectedAcc(p => p.filter(s => s !== opt)); }}
              onReorder={accList.reorderOptions}
              editMode={editOptions}
            />
          </>
        )}

        {/* Instructions */}
        <div className="space-y-2">
          <Label>Instructions manuelles</Label>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} placeholder="Instructions supplémentaires..." />
        </div>

        {/* Modèle de génération */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Modèle de génération</Label>
            <button
              type="button"
              onClick={() => setShowModelEdit(!showModelEdit)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Settings className="h-3 w-3" />
              Gérer
            </button>
          </div>
          <Select value={generationModel} onValueChange={setGenerationModel}>
            <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {models.map((m) => (
                <SelectItem key={m.value} value={m.value} title={m.tooltip}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showModelEdit && (
            <div className="border border-border rounded-lg p-3 space-y-3 bg-secondary/20">
              <p className="text-xs font-medium text-muted-foreground">Modèles disponibles</p>
              <div className="space-y-1">
                {models.map((m) => (
                  <div key={m.value} className="flex items-center justify-between py-1 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{m.label}</span>
                      <span className="text-muted-foreground truncate hidden sm:inline">({m.value})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        removeModel(m.value);
                        if (generationModel === m.value) {
                          const remaining = models.filter(x => x.value !== m.value);
                          if (remaining.length > 0) setGenerationModel(remaining[0].value);
                        }
                      }}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-2 shrink-0"
                      title={isCustom(m.value) ? "Supprimer" : "Masquer"}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-border space-y-2">
                <p className="text-xs text-muted-foreground">Ajouter un modèle</p>
                <div className="flex gap-2">
                  <Input
                    value={newModelValue}
                    onChange={(e) => setNewModelValue(e.target.value)}
                    placeholder="ID du modèle..."
                    className="text-xs h-8"
                  />
                  <Input
                    value={newModelLabel}
                    onChange={(e) => setNewModelLabel(e.target.value)}
                    placeholder="Nom affiché..."
                    className="text-xs h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newModelValue.trim() && newModelLabel.trim()) {
                        addModel(newModelValue, newModelLabel);
                        setNewModelValue("");
                        setNewModelLabel("");
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      addModel(newModelValue, newModelLabel);
                      setNewModelValue("");
                      setNewModelLabel("");
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Nombre d'images */}
        <div className="space-y-2">
          <Label>Nombre d'images par image produit</Label>
          <Select value={imageCount} onValueChange={setImageCount}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => handleGenerate()} disabled={loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Génération en cours..." : "Générer"}
        </Button>

        {/* Log n8n */}
        {n8nLog && (
          <div className={`rounded-lg border text-xs font-mono ${n8nLog.ok ? "border-border bg-secondary/20" : "border-destructive/40 bg-destructive/5"}`}>
            <button
              type="button"
              onClick={() => setLogOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
            >
              <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className={`font-semibold ${n8nLog.ok ? "text-green-500" : "text-destructive"}`}>
                HTTP {n8nLog.status}
              </span>
              <span className="text-muted-foreground flex-1">— réponse n8n · {n8nLog.ts}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(n8nLog.raw); toast.success("Copié !"); }}
                className="text-muted-foreground hover:text-foreground transition-colors mr-1"
                title="Copier"
              >
                <Copy className="h-3 w-3" />
              </button>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${logOpen ? "rotate-180" : ""}`} />
            </button>
            {logOpen && (
              <pre className="px-3 pb-3 overflow-x-auto max-h-60 overflow-y-auto text-[11px] leading-relaxed whitespace-pre-wrap break-all text-foreground/80">
                {(() => { try { return JSON.stringify(JSON.parse(n8nLog.raw), null, 2); } catch { return n8nLog.raw; } })()}
              </pre>
            )}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <Label>Résultats ({results.length})</Label>
              <button onClick={() => setSelectedResults(selectedResults.length === results.length ? [] : [...results])}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {selectedResults.length === results.length ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {results.map((url, i) => (
                <div key={i} className={`relative rounded-lg overflow-hidden border-2 transition-all group ${selectedResults.includes(url) ? "border-primary glow-primary" : "border-border"}`}>
                  <img src={url} className="w-full aspect-square object-cover cursor-pointer" onClick={() => setLightboxIndex(i)} />
                  <button onClick={() => downloadImage(url, i)}
                    className="absolute top-2 right-2 bg-black/50 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all z-10 hover:bg-black/80">
                    <Download className="h-3 w-3 text-white" />
                  </button>
                  <button onClick={() => setSelectedResults((prev) => prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url])}
                    className={`absolute bottom-2 right-2 h-5 w-5 rounded border-2 flex items-center justify-center transition-all z-10 ${selectedResults.includes(url) ? "bg-primary border-primary" : "bg-black/40 border-white/60 opacity-0 group-hover:opacity-100"}`}>
                    {selectedResults.includes(url) && <Check className="h-3 w-3 text-primary-foreground" />}
                  </button>
                </div>
              ))}
            </div>
            <Button variant="outline" disabled={selectedResults.length === 0} onClick={downloadSelected} className="gap-2">
              <Download className="h-4 w-4" />
              Télécharger ({selectedResults.length})
            </Button>
          </div>
        )}

        {/* Lightbox */}
        {lightboxIndex !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setLightboxIndex(null)}>
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); }}
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors">
              <X className="h-5 w-5 text-white" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => i !== null ? Math.max(i - 1, 0) : null); }}
              disabled={lightboxIndex === 0}
              className="absolute left-4 bg-white/10 hover:bg-white/20 disabled:opacity-20 rounded-full p-3 transition-colors">
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
            <img src={results[lightboxIndex]} onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" />
            <button onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => i !== null ? Math.min(i + 1, results.length - 1) : null); }}
              disabled={lightboxIndex === results.length - 1}
              className="absolute right-4 bg-white/10 hover:bg-white/20 disabled:opacity-20 rounded-full p-3 transition-colors">
              <ChevronRight className="h-6 w-6 text-white" />
            </button>
            <div className="absolute bottom-4 flex items-center gap-3">
              <span className="text-white/60 text-sm">{lightboxIndex + 1} / {results.length}</span>
              <button onClick={(e) => { e.stopPropagation(); downloadImage(results[lightboxIndex], lightboxIndex); }}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5 text-white text-sm transition-colors">
                <Download className="h-4 w-4" />
                Télécharger
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
