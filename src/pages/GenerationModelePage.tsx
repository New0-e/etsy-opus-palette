import { useState, useCallback, useEffect } from "react";
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
import { Slider } from "@/components/ui/slider";
import { Loader2, Sparkles, X, Check, Download, FlaskConical, ChevronLeft, ChevronRight, ZoomIn, User, Plus, Star, Trash2, Settings } from "lucide-react";
import { toast } from "sonner";
import TestModeBanner from "@/components/TestModeBanner";

import { webhookUrl } from "@/config/webhooks";

const DEFAULT_COULEURS_CHEVEUX = ["Blond", "Brun", "Noir", "Châtain", "Roux", "Gris", "Blanc", "Platine", "Blond vénitien"];
const DEFAULT_LONGUEUR_CHEVEUX = ["Très court", "Court", "Mi-long", "Long", "Très long", "Bouclé court", "Bouclé long"];
const DEFAULT_COULEURS_YEUX = ["Marron", "Bleu", "Vert", "Noisette", "Gris", "Noir", "Bleu-vert"];
const DEFAULT_CARNATIONS = ["Très clair", "Clair", "Médium", "Hâlé", "Foncé", "Très foncé"];
const DEFAULT_ORIGINES = ["Européenne", "Africaine", "Asiatique", "Latine", "Moyen-Orientale", "Métissée", "Scandinave"];
const DEFAULT_MORPHOLOGIES = ["Mince", "Athlétique", "Normale", "Ronde", "Musclée"];
const DEFAULT_POITRINES = ["Petite (A/B)", "Moyenne (C)", "Généreuse (D/E)", "Très généreuse (F+)"];
const DEFAULT_FESSES = ["Plates", "Normales", "Rondes", "Pulpeuses", "Très pulpeuses"];
const DEFAULT_FORMES_VISAGE = ["Ovale", "Rond", "Carré", "Cœur", "Allongé", "Losange", "Triangulaire"];
const DEFAULT_FORMES_BOUCHE = ["Fine", "Normale", "Pulpeuse", "Très pulpeuse", "Bouche en arc", "Lèvres asymétriques"];
const DEFAULT_FORMES_NEZ = ["Petit", "Fin", "Droit", "Retroussé", "Large", "Aquilin", "Épaté"];
const DEFAULT_FORMES_OREILLES = ["Petites", "Grandes", "Décollées", "Collées", "Lobules épais", "Lobules fins"];
const DEFAULT_SOURCILS = ["Fins", "Épais", "Arqués", "Droits", "Broussailleux", "Séparés", "Rapprochés"];
const DEFAULT_MACHOIRES = ["Fine", "Carrée", "Proéminente", "Douce", "Forte"];
const DEFAULT_COULEURS_FOND = ["Blanc", "Noir", "Gris clair", "Gris foncé", "Beige", "Crème", "Bleu ciel", "Rose pâle", "Vert sauge", "Jaune doux", "Dégradé blanc", "Fond studio"];

const tr: Record<string, string> = {
  "femme": "woman", "homme": "man",
  "Mince": "slim", "Athlétique": "athletic", "Normale": "normal", "Ronde": "curvy", "Musclée": "muscular",
  "Européenne": "European", "Africaine": "African", "Asiatique": "Asian", "Latine": "Latin",
  "Moyen-Orientale": "Middle Eastern", "Métissée": "mixed", "Scandinave": "Scandinavian",
  "Très clair": "very fair", "Clair": "fair", "Médium": "medium", "Hâlé": "tan", "Foncé": "dark", "Très foncé": "very dark",
  "Blond": "blonde", "Brun": "brown", "Noir": "black", "Châtain": "chestnut", "Roux": "red",
  "Gris": "grey", "Blanc": "white", "Platine": "platinum", "Blond vénitien": "strawberry blonde",
  "Très court": "very short", "Court": "short", "Mi-long": "medium length", "Long": "long",
  "Très long": "very long", "Bouclé court": "short curly", "Bouclé long": "long curly",
  "Marron": "brown", "Bleu": "blue", "Vert": "green", "Noisette": "hazel", "Bleu-vert": "teal",
  "Petite (A/B)": "small (A/B)", "Moyenne (C)": "medium (C)", "Généreuse (D/E)": "large (D/E)", "Très généreuse (F+)": "very large (F+)",
  "Plates": "flat", "Normales": "normal", "Rondes": "round", "Pulpeuses": "full", "Très pulpeuses": "very full",
  "Ovale": "oval", "Rond": "round", "Carré": "square", "Cœur": "heart", "Allongé": "oblong", "Losange": "diamond", "Triangulaire": "triangular",
  "Fine": "thin", "Pulpeuse": "full", "Très pulpeuse": "very full",
  "Bouche en arc": "bow-shaped", "Lèvres asymétriques": "asymmetric lips",
  "Petit": "small", "Fin": "thin", "Droit": "straight", "Retroussé": "upturned",
  "Large": "wide", "Aquilin": "aquiline", "Épaté": "broad",
  "Petites": "small", "Grandes": "large", "Décollées": "protruding", "Collées": "close-set",
  "Lobules épais": "thick lobes", "Lobules fins": "thin lobes",
  "Fins": "thin", "Épais": "thick", "Arqués": "arched", "Droits": "straight",
  "Broussailleux": "bushy", "Séparés": "separated", "Rapprochés": "close together",
  "Carrée": "square", "Proéminente": "prominent", "Douce": "soft", "Forte": "strong",
  "Gris clair": "light grey", "Gris foncé": "dark grey", "Beige": "beige", "Crème": "cream",
  "Bleu ciel": "sky blue", "Rose pâle": "pale pink", "Vert sauge": "sage green",
  "Jaune doux": "soft yellow", "Dégradé blanc": "white gradient", "Fond studio": "studio backdrop",
};

const t = (v: string, customTr: Record<string, string> = {}) => customTr[v] ?? tr[v] ?? v;

type ModeleFav = {
  genre: "femme" | "homme";
  age: number;
  taille: number;
  poids: number;
  morphologie: string;
  couleurCheveux: string;
  longueur: string;
  couleurYeux: string;
  carnation: string;
  origine: string;
  poitrine: string;
  fesse: string;
  formeVisage: string;
  formeBouche: string;
  formeNez: string;
  formeOreilles: string;
  sourcil: string;
  machoire: string;
  couleurFond: string;
};

function ChipSelect({ label, options, value, onChange, onAdd, onRemove, onReorder, editMode }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
  onAdd: (fr: string, en: string) => void; onRemove: (opt: string) => void;
  onReorder: (newOrder: string[]) => void; editMode: boolean;
}) {
  const [inputFr, setInputFr] = useState("");
  const [inputEn, setInputEn] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleAdd = () => {
    const fr = inputFr.trim();
    if (!fr) return;
    onAdd(fr, inputEn.trim());
    onChange(fr);
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
            <button type="button" onClick={() => !editMode && onChange(value === opt ? "" : opt)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-all ${editMode ? "pr-6 cursor-grab active:cursor-grabbing" : ""} ${
                value === opt
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-secondary-foreground border-border hover:border-muted-foreground"
              }`}
            >
              {opt}
            </button>
            {editMode && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRemove(opt); if (value === opt) onChange(""); }}
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

type ModelePageState = { loading: boolean; results: string[] };
const modeleDefaults: ModelePageState = { loading: false, results: [] };

export default function GenerationModelePage() {
  const [psState, psPatch] = usePageState<ModelePageState>("generation-modele", modeleDefaults);
  const loading = psState.loading;
  const results = psState.results;
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
  const [formeVisage, setFormeVisage] = useState("");
  const [formeBouche, setFormeBouche] = useState("");
  const [formeNez, setFormeNez] = useState("");
  const [formeOreilles, setFormeOreilles] = useState("");
  const [sourcil, setSourcil] = useState("");
  const [machoire, setMachoire] = useState("");
  const [couleurFond, setCouleurFond] = useState("");
  const [editOptions, setEditOptions] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [imageCount, setImageCount] = useState("3");
  const [generationModel, setGenerationModel] = useState("gemini-2.5-flash-image");
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [testMode, setTestMode] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Option lists avec persistance
  const morphologieList = useOptionsList("modele-morphologie", DEFAULT_MORPHOLOGIES);
  const origineList = useOptionsList("modele-origine", DEFAULT_ORIGINES);
  const carnationList = useOptionsList("modele-carnation", DEFAULT_CARNATIONS);
  const chevList = useOptionsList("modele-cheveux", DEFAULT_COULEURS_CHEVEUX);
  const longueurList = useOptionsList("modele-longueur", DEFAULT_LONGUEUR_CHEVEUX);
  const yeuxList = useOptionsList("modele-yeux", DEFAULT_COULEURS_YEUX);
  const poitrineList = useOptionsList("modele-poitrine", DEFAULT_POITRINES);
  const fesseList = useOptionsList("modele-fesse", DEFAULT_FESSES);
  const visageList = useOptionsList("modele-visage", DEFAULT_FORMES_VISAGE);
  const boucheList = useOptionsList("modele-bouche", DEFAULT_FORMES_BOUCHE);
  const nezList = useOptionsList("modele-nez", DEFAULT_FORMES_NEZ);
  const oreillesList = useOptionsList("modele-oreilles", DEFAULT_FORMES_OREILLES);
  const sourcilsList = useOptionsList("modele-sourcils", DEFAULT_SOURCILS);
  const machoireList = useOptionsList("modele-machoire", DEFAULT_MACHOIRES);
  const fondList = useOptionsList("modele-fond", DEFAULT_COULEURS_FOND);

  // Traductions custom (options ajoutées par l'utilisateur)
  const [customTr, setCustomTr] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("modele-custom-tr") ?? "{}"); } catch { return {}; }
  });
  const addCustomTr = (fr: string, en: string) => {
    if (!en) return;
    setCustomTr(prev => {
      const next = { ...prev, [fr]: en };
      localStorage.setItem("modele-custom-tr", JSON.stringify(next));
      return next;
    });
  };
  const tAll = (v: string) => t(v, customTr);

  // Favoris / presets de profil
  const { favs: modelFavs, saveFav: saveModelFav, removeFav: removeModelFav } = useFavorites<ModeleFav>("gen-modele");
  const [savingFav, setSavingFav] = useState(false);
  const [favName, setFavName] = useState("");

  // Gestion des modèles IA
  const { models, addModel, removeModel, isCustom } = useModelsList();
  const [showModelEdit, setShowModelEdit] = useState(false);
  const [newModelValue, setNewModelValue] = useState("");
  const [newModelLabel, setNewModelLabel] = useState("");

  useEffect(() => {
    if (models.length > 0 && !models.some(m => m.value === generationModel)) {
      setGenerationModel(models[0].value);
    }
  }, [models, generationModel]);

  const getCurrentFavData = (): ModeleFav => ({
    genre, age: age[0], taille: taille[0], poids: poids[0],
    morphologie, couleurCheveux, longueur, couleurYeux, carnation, origine,
    poitrine, fesse, formeVisage, formeBouche, formeNez, formeOreilles, sourcil, machoire, couleurFond,
  });

  const applyFav = (data: ModeleFav) => {
    setGenre(data.genre);
    setAge([data.age]);
    setTaille([data.taille]);
    setPoids([data.poids]);
    setMorphologie(data.morphologie);
    setCouleurCheveux(data.couleurCheveux);
    setLongueur(data.longueur);
    setCouleurYeux(data.couleurYeux);
    setCarnation(data.carnation);
    setOrigine(data.origine);
    setPoitrine(data.poitrine);
    setFesse(data.fesse);
    setFormeVisage(data.formeVisage);
    setFormeBouche(data.formeBouche);
    setFormeNez(data.formeNez);
    setFormeOreilles(data.formeOreilles);
    setSourcil(data.sourcil);
    setMachoire(data.machoire);
    setCouleurFond(data.couleurFond);
  };

  const handleSaveFav = () => {
    const name = favName.trim();
    if (!name) return;
    saveModelFav(name, getCurrentFavData());
    setFavName("");
    setSavingFav(false);
    toast.success("Favori enregistré !");
  };

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
    psPatch({ loading: true, results: [] });
    try {
      const formData = new FormData();
      formData.append("genre", tAll(genre));
      formData.append("age", String(age[0]));
      formData.append("taille", `${taille[0]} cm`);
      formData.append("poids", `${poids[0]} kg`);
      formData.append("image_count", imageCount);
      formData.append("generation_model", generationModel);
      if (morphologie) formData.append("morphologie", tAll(morphologie));
      if (couleurCheveux) formData.append("couleur_cheveux", tAll(couleurCheveux));
      if (longueur) formData.append("longueur_cheveux", tAll(longueur));
      if (couleurYeux) formData.append("couleur_yeux", tAll(couleurYeux));
      if (carnation) formData.append("carnation", tAll(carnation));
      if (origine) formData.append("origine", tAll(origine));
      if (genre === "femme" && poitrine) formData.append("poitrine", tAll(poitrine));
      if (fesse) formData.append("fesses", tAll(fesse));
      if (formeVisage) formData.append("forme_visage", tAll(formeVisage));
      if (formeBouche) formData.append("forme_bouche", tAll(formeBouche));
      if (formeNez) formData.append("forme_nez", tAll(formeNez));
      if (formeOreilles) formData.append("forme_oreilles", tAll(formeOreilles));
      if (sourcil) formData.append("sourcils", tAll(sourcil));
      if (machoire) formData.append("machoire", tAll(machoire));
      if (couleurFond) formData.append("couleur_fond", tAll(couleurFond));
      if (instructions) formData.append("instructions", instructions);

      const res = await fetch(webhookUrl("generationModele", testMode), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 413) { toast.error("Données trop lourdes"); return; }
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

        if (urls.length) { psPatch({ results: urls }); toast.success("Génération terminée !"); }
        else { toast.success("Workflow lancé — les images seront disponibles sous peu."); }
      } catch {
        toast.success("Workflow lancé !");
      }
    } catch {
      toast.error("Erreur de connexion au workflow");
    } finally {
      psPatch({ loading: false });
    }
  }, [genre, age, taille, poids, morphologie, couleurCheveux, longueur, couleurYeux, carnation, origine, poitrine, fesse, formeVisage, formeBouche, formeNez, formeOreilles, sourcil, machoire, couleurFond, instructions, imageCount, generationModel, testMode, psPatch]);

  return (
    <div className="max-w-3xl mx-auto">
      <TestModeBanner active={testMode} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Modèle</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>Mode test</span>
          <Switch checked={testMode} onCheckedChange={setTestMode} />
        </div>
      </div>

      <div className="tool-card space-y-6">

        {/* Favoris de profil */}
        <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-sm font-medium">Profils favoris</span>
            </div>
            {!savingFav ? (
              <button
                type="button"
                onClick={() => setSavingFav(true)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Enregistrer ce profil
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={favName}
                  onChange={(e) => setFavName(e.target.value)}
                  placeholder="Nom du profil..."
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
          {modelFavs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun profil — configurez votre modèle et enregistrez.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {modelFavs.map((fav) => (
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
                    onClick={() => removeModelFav(fav.id)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover/fav:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Genre */}
        <div className="flex items-center gap-4">
          <Label>Genre :</Label>
          <button type="button" onClick={() => setGenre("femme")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-all ${genre === "femme" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border hover:border-muted-foreground"}`}
          >
            <User className="h-3.5 w-3.5" />Femme
          </button>
          <button type="button" onClick={() => setGenre("homme")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-all ${genre === "homme" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border hover:border-muted-foreground"}`}
          >
            <User className="h-3.5 w-3.5" />Homme
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

        <ChipSelect label="Morphologie" options={morphologieList.options} value={morphologie} onChange={setMorphologie} onAdd={(fr, en) => { morphologieList.addOption(fr); addCustomTr(fr, en); }} onRemove={morphologieList.removeOption} onReorder={morphologieList.reorderOptions} editMode={editOptions} />
        <ChipSelect label="Origine" options={origineList.options} value={origine} onChange={setOrigine} onAdd={(fr, en) => { origineList.addOption(fr); addCustomTr(fr, en); }} onRemove={origineList.removeOption} onReorder={origineList.reorderOptions} editMode={editOptions} />
        <ChipSelect label="Carnation" options={carnationList.options} value={carnation} onChange={setCarnation} onAdd={(fr, en) => { carnationList.addOption(fr); addCustomTr(fr, en); }} onRemove={carnationList.removeOption} onReorder={carnationList.reorderOptions} editMode={editOptions} />
        <ChipSelect label="Couleur des cheveux" options={chevList.options} value={couleurCheveux} onChange={setCouleurCheveux} onAdd={(fr, en) => { chevList.addOption(fr); addCustomTr(fr, en); }} onRemove={chevList.removeOption} onReorder={chevList.reorderOptions} editMode={editOptions} />
        <ChipSelect label="Longueur des cheveux" options={longueurList.options} value={longueur} onChange={setLongueur} onAdd={(fr, en) => { longueurList.addOption(fr); addCustomTr(fr, en); }} onRemove={longueurList.removeOption} onReorder={longueurList.reorderOptions} editMode={editOptions} />
        <ChipSelect label="Couleur des yeux" options={yeuxList.options} value={couleurYeux} onChange={setCouleurYeux} onAdd={(fr, en) => { yeuxList.addOption(fr); addCustomTr(fr, en); }} onRemove={yeuxList.removeOption} onReorder={yeuxList.reorderOptions} editMode={editOptions} />

        {genre === "femme" && (
          <ChipSelect label="Taille de poitrine" options={poitrineList.options} value={poitrine} onChange={setPoitrine} onAdd={(fr, en) => { poitrineList.addOption(fr); addCustomTr(fr, en); }} onRemove={poitrineList.removeOption} onReorder={poitrineList.reorderOptions} editMode={editOptions} />
        )}

        <ChipSelect label="Fesses" options={fesseList.options} value={fesse} onChange={setFesse} onAdd={(fr, en) => { fesseList.addOption(fr); addCustomTr(fr, en); }} onRemove={fesseList.removeOption} onReorder={fesseList.reorderOptions} editMode={editOptions} />

        <div className="border-t border-border pt-4">
          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 block">Visage</Label>
          <div className="space-y-4">
            <ChipSelect label="Forme du visage" options={visageList.options} value={formeVisage} onChange={setFormeVisage} onAdd={(fr, en) => { visageList.addOption(fr); addCustomTr(fr, en); }} onRemove={visageList.removeOption} onReorder={visageList.reorderOptions} editMode={editOptions} />
            <ChipSelect label="Bouche / Lèvres" options={boucheList.options} value={formeBouche} onChange={setFormeBouche} onAdd={(fr, en) => { boucheList.addOption(fr); addCustomTr(fr, en); }} onRemove={boucheList.removeOption} onReorder={boucheList.reorderOptions} editMode={editOptions} />
            <ChipSelect label="Nez" options={nezList.options} value={formeNez} onChange={setFormeNez} onAdd={(fr, en) => { nezList.addOption(fr); addCustomTr(fr, en); }} onRemove={nezList.removeOption} onReorder={nezList.reorderOptions} editMode={editOptions} />
            <ChipSelect label="Oreilles" options={oreillesList.options} value={formeOreilles} onChange={setFormeOreilles} onAdd={(fr, en) => { oreillesList.addOption(fr); addCustomTr(fr, en); }} onRemove={oreillesList.removeOption} onReorder={oreillesList.reorderOptions} editMode={editOptions} />
            <ChipSelect label="Sourcils" options={sourcilsList.options} value={sourcil} onChange={setSourcil} onAdd={(fr, en) => { sourcilsList.addOption(fr); addCustomTr(fr, en); }} onRemove={sourcilsList.removeOption} onReorder={sourcilsList.reorderOptions} editMode={editOptions} />
            <ChipSelect label="Mâchoire" options={machoireList.options} value={machoire} onChange={setMachoire} onAdd={(fr, en) => { machoireList.addOption(fr); addCustomTr(fr, en); }} onRemove={machoireList.removeOption} onReorder={machoireList.reorderOptions} editMode={editOptions} />
          </div>
        </div>

        <ChipSelect label="Couleur du fond" options={fondList.options} value={couleurFond} onChange={setCouleurFond} onAdd={(fr, en) => { fondList.addOption(fr); addCustomTr(fr, en); }} onRemove={fondList.removeOption} onReorder={fondList.reorderOptions} editMode={editOptions} />

        {/* Instructions */}
        <div className="space-y-2">
          <Label>Instructions supplémentaires</Label>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3}
            placeholder="Détails supplémentaires sur le modèle, la mise en scène..." />
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

        {/* Nombre de Modèle */}
        <div className="space-y-2">
          <Label>Nombre de Modèle</Label>
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
