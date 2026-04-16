import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Loader2, Sparkles, X, Check, Download, FlaskConical, ChevronLeft, ChevronRight, ZoomIn, User } from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/0075596e-85d8-4549-bb28-80ba00a727b9";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/0075596e-85d8-4549-bb28-80ba00a727b9";

const couleursCheveux = ["Blond", "Brun", "Noir", "Châtain", "Roux", "Gris", "Blanc", "Platine", "Blond vénitien"];
const longueurCheveux = ["Très court", "Court", "Mi-long", "Long", "Très long", "Bouclé court", "Bouclé long"];
const couleursYeux = ["Marron", "Bleu", "Vert", "Noisette", "Gris", "Noir", "Bleu-vert"];
const carnations = ["Très clair", "Clair", "Médium", "Hâlé", "Foncé", "Très foncé"];
const origines = ["Européenne", "Africaine", "Asiatique", "Latine", "Moyen-Orientale", "Métissée", "Scandinave"];
const morphologies = ["Mince", "Athlétique", "Normale", "Ronde", "Musclée"];
const poitrines = ["Petite (A/B)", "Moyenne (C)", "Généreuse (D/E)", "Très généreuse (F+)"];
const fesses = ["Plates", "Normales", "Rondes", "Pulpeuses", "Très pulpeuses"];
const poses = [
  "Debout face", "Debout profil", "Debout trois-quarts", "Assise",
  "Marchant", "Bras croisés", "Mains dans les poches", "Regardant au loin",
];
const tenues = ["Casual", "Élégante", "Sportive", "Soirée", "Business", "Décontractée", "Été", "Hiver"];
const generationModels = [
  { value: "gemini-2.5-flash-image", label: "Nano Banana", tooltip: "Idéal pour la génération standard. Bon équilibre vitesse/qualité." },
  { value: "gemini-3-pro-image-preview", label: "Nano Banana Pro", tooltip: "Haute qualité pour les rendus détaillés et réalistes." },
  { value: "gemini-3.1-flash-image-preview", label: "Nano Banana 2", tooltip: "Dernière génération. Meilleur choix qualité/vitesse." },
];

function ChipSelect({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => onChange(value === opt ? "" : opt)}
            className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
              value === opt
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary text-secondary-foreground border-border hover:border-muted-foreground"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GenerationModelePage() {
  const [genre, setGenre] = useState<"femme" | "homme">("femme");
  const [age, setAge] = useState([28]);
  const [taille, setTaille] = useState([168]);
  const [poids, setPoids] = useState([60]);
  const [morphologie, setMorphologie] = useState("");
  const [couleurCheveux, setCouleurCheveux] = useState("");
  const [longueur, setLongueur] = useState("");
  const [couleurYeux, setCouleurYeux] = useState("");
  const [carnation, setCarnation] = useState("");
  const [origine, setOrigine] = useState("");
  const [poitrine, setPoitrine] = useState("");
  const [fesse, setFesse] = useState("");
  const [pose, setPose] = useState("");
  const [tenue, setTenue] = useState("");
  const [instructions, setInstructions] = useState("");
  const [imageCount, setImageCount] = useState("3");
  const [generationModel, setGenerationModel] = useState("gemini-2.5-flash-image");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [testMode, setTestMode] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const downloadImage = useCallback((url: string, index: number) => {
    const ext = url.startsWith("data:image/png") ? "png" : "jpg";
    const a = document.createElement("a");
    a.href = url;
    a.download = `modele-${index + 1}.${ext}`;
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

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setResults([]);
    try {
      const formData = new FormData();
      formData.append("genre", genre);
      formData.append("age", String(age[0]));
      formData.append("taille", `${taille[0]} cm`);
      formData.append("poids", `${poids[0]} kg`);
      formData.append("image_count", imageCount);
      formData.append("generation_model", generationModel);
      if (morphologie) formData.append("morphologie", morphologie);
      if (couleurCheveux) formData.append("couleur_cheveux", couleurCheveux);
      if (longueur) formData.append("longueur_cheveux", longueur);
      if (couleurYeux) formData.append("couleur_yeux", couleurYeux);
      if (carnation) formData.append("carnation", carnation);
      if (origine) formData.append("origine", origine);
      if (genre === "femme" && poitrine) formData.append("poitrine", poitrine);
      if (fesse) formData.append("fesses", fesse);
      if (pose) formData.append("pose", pose);
      if (tenue) formData.append("tenue", tenue);
      if (instructions) formData.append("instructions", instructions);

      const res = await fetch(testMode ? WEBHOOK_TEST : WEBHOOK_PROD, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 404) { toast.error("Webhook introuvable — en mode test, lancez d'abord un test dans n8n"); return; }
        toast.error(`Erreur ${res.status}`);
        return;
      }

      const text = await res.text();
      console.log("[GenerationModele] raw response:", text.slice(0, 2000));
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
  }, [genre, age, taille, poids, morphologie, couleurCheveux, longueur, couleurYeux, carnation, origine, poitrine, fesse, pose, tenue, instructions, imageCount, generationModel, testMode]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Génération Modèle</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>Mode test</span>
          <Switch checked={testMode} onCheckedChange={setTestMode} />
        </div>
      </div>

      <div className="tool-card space-y-6">

        {/* Genre */}
        <div className="flex items-center gap-4">
          <Label>Genre :</Label>
          <button
            type="button"
            onClick={() => setGenre("femme")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-all ${
              genre === "femme" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border hover:border-muted-foreground"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Femme
          </button>
          <button
            type="button"
            onClick={() => setGenre("homme")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-all ${
              genre === "homme" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border hover:border-muted-foreground"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            Homme
          </button>
        </div>

        {/* Âge */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label>Âge</Label>
            <span className="text-sm font-medium text-primary">{age[0]} ans</span>
          </div>
          <Slider min={18} max={70} step={1} value={age} onValueChange={setAge} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>18 ans</span><span>70 ans</span>
          </div>
        </div>

        {/* Taille */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label>Taille</Label>
            <span className="text-sm font-medium text-primary">{taille[0]} cm</span>
          </div>
          <Slider min={150} max={200} step={1} value={taille} onValueChange={setTaille} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>150 cm</span><span>200 cm</span>
          </div>
        </div>

        {/* Poids */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <Label>Poids</Label>
            <span className="text-sm font-medium text-primary">{poids[0]} kg</span>
          </div>
          <Slider min={40} max={130} step={1} value={poids} onValueChange={setPoids} className="w-full" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>40 kg</span><span>130 kg</span>
          </div>
        </div>

        <ChipSelect label="Morphologie" options={morphologies} value={morphologie} onChange={setMorphologie} />
        <ChipSelect label="Origine" options={origines} value={origine} onChange={setOrigine} />
        <ChipSelect label="Carnation" options={carnations} value={carnation} onChange={setCarnation} />
        <ChipSelect label="Couleur des cheveux" options={couleursCheveux} value={couleurCheveux} onChange={setCouleurCheveux} />
        <ChipSelect label="Longueur des cheveux" options={longueurCheveux} value={longueur} onChange={setLongueur} />
        <ChipSelect label="Couleur des yeux" options={couleursYeux} value={couleurYeux} onChange={setCouleurYeux} />

        {genre === "femme" && (
          <ChipSelect label="Taille de poitrine" options={poitrines} value={poitrine} onChange={setPoitrine} />
        )}

        <ChipSelect label="Fesses" options={fesses} value={fesse} onChange={setFesse} />
        <ChipSelect label="Pose" options={poses} value={pose} onChange={setPose} />
        <ChipSelect label="Tenue" options={tenues} value={tenue} onChange={setTenue} />

        {/* Instructions */}
        <div className="space-y-2">
          <Label>Instructions supplémentaires</Label>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3}
            placeholder="Détails supplémentaires sur le modèle, la mise en scène..." />
        </div>

        {/* Modèle de génération */}
        <div className="space-y-2">
          <Label>Modèle de génération</Label>
          <Select value={generationModel} onValueChange={setGenerationModel}>
            <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {generationModels.map((m) => (
                <SelectItem key={m.value} value={m.value} title={m.tooltip}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Nombre d'images */}
        <div className="space-y-2">
          <Label>Nombre d'images</Label>
          <Select value={imageCount} onValueChange={setImageCount}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleGenerate} disabled={loading} className="w-full gap-2">
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
                  <button onClick={() => setLightboxIndex(i)}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all opacity-0 group-hover:opacity-100">
                    <ZoomIn className="h-8 w-8 text-white drop-shadow" />
                  </button>
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
