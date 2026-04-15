import { useState, useCallback, useEffect } from "react";
import { driveStore } from "@/lib/driveStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles, Upload, X, Check, Download, FlaskConical, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
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

const environments = [
  "Studio minimaliste fond blanc", "Studio marbre luxueux", "Salon boheme",
  "Cuisine moderne ensoleilee", "Chambre cocooning", "Salle de bain luxueuse",
  "Bureau scandinave", "Terrasse cafe parisien", "Jardin verdoyant",
  "Flat lay table bois rustique", "Flat lay draps lin froisse",
];
const eclairages = [
  "Golden Hour lumiere chaude", "Lumiere naturelle fenetre",
  "Studio Softbox pro", "Cinematique moody contraste",
];
const angles = [
  "Macro close-up details", "Eye-level vue standard",
  "Top-down flat lay 90 degres", "Trois quarts dynamique",
];
const accessoires = [
  "Plantes Monstera et Eucalyptus", "Livres et tasse cafe fumante",
  "Tissus soie et petales de fleurs", "Miroirs vintage et gouttes eau",
  "Clavier mecanique et plante grasse", "Tapis moelleux",
  "Nourriture et ingredients cuisine",
];

function DropZone({ label, files, onFiles }: { label: string; files: File[]; onFiles: (f: File[]) => void }) {
  const [dragOver, setDragOver] = useState(false);

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
              <img src={URL.createObjectURL(f)} className="h-16 w-16 rounded-md object-cover border border-border" />
              <button onClick={() => onFiles(files.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 bg-destructive rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-3 w-3 text-destructive-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiSelect({ label, options, selected, onChange, customValue, onCustomChange }: {
  label: string; options: string[]; selected: string[]; onChange: (s: string[]) => void;
  customValue: string; onCustomChange: (v: string) => void;
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
              selected.includes(opt) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground border-border hover:border-muted-foreground"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <Input placeholder="Ajouter une option personnalisée..." value={customValue} onChange={(e) => onCustomChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && customValue.trim()) {
            e.preventDefault();
            onChange([...selected, customValue.trim()]);
            onCustomChange("");
          }
        }}
      />
    </div>
  );
}

export default function GenerationPhotosPage() {
  const [mode, setMode] = useState<"auto" | "manuel">("auto");
  const [productImages, setProductImages] = useState<File[]>([]);
  const [bgImages, setBgImages] = useState<File[]>([]);
  const [modelImages, setModelImages] = useState<File[]>([]);
  const [categorie, setCategorie] = useState("");
  const [selectedEnv, setSelectedEnv] = useState<string[]>([]);
  const [customEnv, setCustomEnv] = useState("");
  const [selectedEcl, setSelectedEcl] = useState<string[]>([]);
  const [customEcl, setCustomEcl] = useState("");
  const [selectedAngle, setSelectedAngle] = useState<string[]>([]);
  const [customAngle, setCustomAngle] = useState("");
  const [selectedAcc, setSelectedAcc] = useState<string[]>([]);
  const [customAcc, setCustomAcc] = useState("");
  const [instructions, setInstructions] = useState("");
  const [imageCount, setImageCount] = useState("3");
  const [generationModel, setGenerationModel] = useState("gemini-2.5-flash-preview-image-generation");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [testMode, setTestMode] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
    setLoading(true);
    setResults([]);
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
        if (selectedEnv.length) formData.append("environnement", selectedEnv.join(", "));
        if (selectedEcl.length) formData.append("eclairage", selectedEcl.join(", "));
        if (selectedAngle.length) formData.append("angle", selectedAngle.join(", "));
        if (selectedAcc.length) formData.append("accessoires", selectedAcc.join(", "));
      }

      const res = await fetch(testMode ? WEBHOOK_TEST : WEBHOOK_PROD, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 413) { toast.error("Images trop lourdes — réduisez leur taille"); return; }
        if (res.status === 404) { toast.error("Webhook introuvable — en mode test, lancez d'abord un test dans n8n"); return; }
        toast.error(`Erreur ${res.status}`);
        return;
      }

      const text = await res.text();
      console.log("[GenerationPhotos] raw response:", text.slice(0, 2000));
      try {
        const json = JSON.parse(text);
        console.log("[GenerationPhotos] parsed JSON:", JSON.stringify(json, null, 2).slice(0, 2000));
        const arr = Array.isArray(json) ? json : [json];

        const cleanB64 = (s: string) => s.replace(/\s+/g, "").replace(/^data:[^,]+,/, "");

        const toDataUrl = (item: any): string | null => {
          // Format binaire n8n : item.binary.data.data + item.binary.data.mimeType
          if (item?.binary?.data?.data) {
            const mime = item.binary.data.mimeType ?? "image/png";
            return `data:${mime};base64,${cleanB64(item.binary.data.data)}`;
          }
          // Plusieurs champs binaires (ex: binary.image, binary.result...)
          if (item?.binary) {
            for (const key of Object.keys(item.binary)) {
              const b = item.binary[key];
              if (b?.data) return `data:${b.mimeType ?? "image/png"};base64,${cleanB64(b.data)}`;
            }
          }
          // base64 brut avec mimeType (format Gemini/Imagen direct)
          if (item?.data && item?.mimeType) return `data:${item.mimeType};base64,${cleanB64(item.data)}`;
          if (item?.b64_json) return `data:image/jpeg;base64,${cleanB64(item.b64_json)}`;
          if (item?.base64) return `data:image/jpeg;base64,${cleanB64(item.base64)}`;
          if (item?.image && !item.image.startsWith("http")) return `data:image/jpeg;base64,${cleanB64(item.image)}`;
          return null;
        };

        const urls = arr.flatMap((item: any) => {
          // URLs directes
          const directUrls: string[] = (item.image_urls ?? item.urls ?? (item.url ? [item.url] : []));
          if (directUrls.length) return directUrls;
          // base64 au niveau racine ou format binaire n8n
          const b64 = toDataUrl(item);
          if (b64) return [b64];
          // tableau imbriqué d'images base64
          if (Array.isArray(item.images)) return item.images.map(toDataUrl).filter(Boolean);
          return [];
        }).filter(Boolean);

        if (urls.length) { setResults(urls); toast.success("Génération terminée !"); }
        else { toast.success("Workflow lancé — les images seront disponibles sous peu."); }
      } catch {
        toast.success("Workflow lancé !");
      }
    } catch {
      toast.error("Erreur de connexion au workflow");
    } finally {
      setLoading(false);
    }
  }, [mode, productImages, bgImages, modelImages, imageCount, instructions, categorie, selectedEnv, selectedEcl, selectedAngle, selectedAcc, testMode, generationModel]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Génération Images Produit</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>Mode test</span>
          <Switch checked={testMode} onCheckedChange={setTestMode} />
        </div>
      </div>
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
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Input value={categorie} onChange={(e) => setCategorie(e.target.value)} placeholder="Ex: Bijoux, Décoration..." />
            </div>

            {/* Selections */}
            <MultiSelect label="Environnement" options={environments} selected={selectedEnv} onChange={setSelectedEnv} customValue={customEnv} onCustomChange={setCustomEnv} />
            <MultiSelect label="Éclairage" options={eclairages} selected={selectedEcl} onChange={setSelectedEcl} customValue={customEcl} onCustomChange={setCustomEcl} />
            <MultiSelect label="Angle de vue" options={angles} selected={selectedAngle} onChange={setSelectedAngle} customValue={customAngle} onCustomChange={setCustomAngle} />
            <MultiSelect label="Accessoires" options={accessoires} selected={selectedAcc} onChange={setSelectedAcc} customValue={customAcc} onCustomChange={setCustomAcc} />
          </>
        )}

        {/* Instructions */}
        <div className="space-y-2">
          <Label>Instructions manuelles</Label>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} placeholder="Instructions supplémentaires..." />
        </div>

        {/* Modèle de génération */}
        <div className="space-y-2">
          <Label>Modèle de génération</Label>
          <Select value={generationModel} onValueChange={setGenerationModel}>
            <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini-2.5-flash-preview-image-generation">Nano Banana (Gemini 2.5 Flash Preview Image)</SelectItem>
              <SelectItem value="gemini-3-pro-image-generation">Nano Banana Pro (Gemini 3 Pro Image)</SelectItem>
              <SelectItem value="gemini-3.1-flash-image-generation">Nano Banana 2 (Gemini 3.1 Flash Image)</SelectItem>
              <SelectItem value="imagen-4.0-generate-001">Imagen 4 Generate</SelectItem>
              <SelectItem value="imagen-4.0-ultra-generate-001">Imagen 4 Ultra Generate</SelectItem>
              <SelectItem value="imagen-4.0-fast-generate-001">Imagen 4 Fast Generate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Image Count */}
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
                  {/* Overlay agrandir */}
                  <button onClick={() => setLightboxIndex(i)}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all opacity-0 group-hover:opacity-100">
                    <ZoomIn className="h-8 w-8 text-white drop-shadow" />
                  </button>
                  {/* Bouton télécharger individuel */}
                  <button onClick={() => downloadImage(url, i)}
                    className="absolute top-2 left-2 bg-black/50 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all z-10 hover:bg-black/80">
                    <Download className="h-3 w-3 text-white" />
                  </button>
                  {/* Checkbox sélection */}
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
