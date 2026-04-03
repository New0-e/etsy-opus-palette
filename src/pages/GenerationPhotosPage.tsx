import { useState, useCallback, useEffect, useRef } from "react";
import { driveStore } from "@/lib/driveStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Sparkles, Upload, X, Check, Download, FlaskConical } from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/edc44347-0c53-473e-8047-956afd36b4f4";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/edc44347-0c53-473e-8047-956afd36b4f4";

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
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [testMode, setTestMode] = useState(false);

  const prevProductImagesRef = useRef<File[]>([]);

  const handleGenerate = useCallback(async (currentMode: "auto" | "manuel" = mode) => {
    if (productImages.length === 0) { toast.error("Ajoutez au moins une image produit"); return; }
    setLoading(true);
    setResults([]);
    try {
      const formData = new FormData();
      productImages.forEach((f) => formData.append("product_images", f));
      bgImages.forEach((f) => formData.append("bg_images", f));
      modelImages.forEach((f) => formData.append("model_images", f));
      formData.append("mode", currentMode);
      formData.append("image_count", imageCount);
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

      if (!res.ok) { toast.error(`Erreur ${res.status}`); return; }

      const text = await res.text();
      try {
        const json = JSON.parse(text);
        const arr = Array.isArray(json) ? json : [json];
        const urls = arr.flatMap((item: any) =>
          item.image_urls ?? item.urls ?? item.images ?? (item.url ? [item.url] : [])
        ).filter(Boolean);
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
  }, [mode, productImages, bgImages, modelImages, imageCount, instructions, categorie, selectedEnv, selectedEcl, selectedAngle, selectedAcc, testMode]);

  useEffect(() => {
    if (mode === "auto" && productImages.length > 0 && productImages !== prevProductImagesRef.current) {
      prevProductImagesRef.current = productImages;
      handleGenerate("auto");
    }
  }, [productImages, mode, handleGenerate]);

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

        {mode === "manuel" ? (
          <Button onClick={() => handleGenerate("manuel")} disabled={loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Génération en cours..." : "Générer"}
          </Button>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Sparkles className="h-4 w-4 text-primary" />}
            {loading ? "Envoi automatique en cours..." : "Envoi automatique dès qu'une image est ajoutée"}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-border">
            <Label>Résultats</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {results.map((url, i) => (
                <button key={i} onClick={() => setSelectedResults((prev) => prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url])}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${selectedResults.includes(url) ? "border-primary glow-primary" : "border-border"}`}
                >
                  <img src={url} className="w-full aspect-square object-cover" />
                  {selectedResults.includes(url) && (
                    <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <Button variant="outline" disabled={selectedResults.length === 0} className="gap-2">
              <Download className="h-4 w-4" />
              Télécharger ({selectedResults.length})
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
