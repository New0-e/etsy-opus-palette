import { FileText, ImageDown, Camera, ExternalLink, Table2, Store, Package, FolderPlus, Tags, BarChart3, UserSearch, FileImage, PersonStanding, Layers, AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

const tools = [
  { title: "Gen Fiches Produits", desc: "Créer une nouvelle fiche produit Etsy", icon: FileText, url: "/creation-fiche", color: "text-primary" },
  { title: "Téléchargement Images", desc: "Télécharger les images scrapées", icon: ImageDown, url: "/download-images", color: "text-success" },
  { title: "Gen Images", desc: "Générer des images produit avec IA", icon: Camera, url: "/generation-photos", color: "text-warning" },
];

const secondaryTools = [
  { title: "Modèle", desc: "Générer des photos de modèle avec IA", icon: PersonStanding, url: "/generation-modele", color: "text-orange-400" },
  { title: "Analyse Image", desc: "Extraire les tags depuis une image", icon: Tags, url: "/analyse-image", color: "text-blue-400" },
  { title: "Analyse Tags", desc: "Analyser et optimiser vos tags", icon: BarChart3, url: "/analyse-tags", color: "text-purple-400" },
  { title: "Tags Concurrent", desc: "Espionner les tags des concurrents", icon: UserSearch, url: "/tags-concurrent", color: "text-pink-400" },
  { title: "Descriptif Image", desc: "Générer un descriptif depuis une image", icon: FileImage, url: "/descriptif-image", color: "text-teal-400" },
  { title: "Idées sous Niche", desc: "Générer des idées de sous-niches", icon: Layers, url: "/generation-idee-sous-niche", color: "text-cyan-400" },
];

const sheets = [
  { title: "Tableau Contrôle", icon: Table2, url: "https://docs.google.com/spreadsheets/d/1u3_-YtIYqCnO2YEPfLh1cCsjd2CcRiT1cKileCLA0Ig/edit?gid=0#gid=0" },
  { title: "Liste Boutique", icon: Store, url: "https://docs.google.com/spreadsheets/d/1S1LsdSWUYZwBgFtcWu8hvOo27Y7rZCcyRShl7UI-zKo/edit?gid=1536179428#gid=1536179428" },
  { title: "Suivi Commande", icon: Package, url: "https://docs.google.com/spreadsheets/d/1exMlQ6dnfIGF7xsgUJskk57IRypVK29E/edit?gid=513162334#gid=513162334" },
];

type CommandeAlert = {
  id: string;
  noEtsy: string;
  refProduit: string;
  boutique: string;
  noTracktagos: string;
  dateLimiteEnvoi: string;
};

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

function loadCommandesAChanger(): CommandeAlert[] {
  try {
    const all = JSON.parse(localStorage.getItem("suivi-commandes-v1") ?? "[]");
    return all.filter((c: any) =>
      c.statutTracktagos === "Numéro de Suivi à changer" ||
      (c.statutTracktagos === "Attente 8H" &&
        c.attente8HStartedAt &&
        Date.now() - new Date(c.attente8HStartedAt).getTime() >= EIGHT_HOURS_MS)
    );
  } catch { return []; }
}

export default function HomePage() {
  const navigate = useNavigate();
  const [newBoutiqueName, setNewBoutiqueName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [commandesAlert, setCommandesAlert] = useState<CommandeAlert[]>([]);

  useEffect(() => {
    const refresh = () => setCommandesAlert(loadCommandesAChanger());
    refresh();

    // Re-vérifie toutes les minutes (les timers 8H peuvent expirer pendant que le dashboard est ouvert)
    const interval = setInterval(refresh, 60_000);

    // Re-vérifie quand l'onglet redevient actif (retour depuis un autre onglet ou une autre app)
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const handleCreateBoutique = () => {
    if (!newBoutiqueName.trim()) return;
    // This would call n8n or Drive API to create the folder
    alert(`Création du dossier "${newBoutiqueName}" dans Google Drive...`);
    setNewBoutiqueName("");
    setDialogOpen(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard Etsy</h1>
      </div>

      {/* Alerte — Numéros de suivi à changer */}
      {commandesAlert.length > 0 && (
        <section>
          <div className="rounded-xl border border-primary/40 bg-primary/8 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-primary/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm text-primary">
                  {commandesAlert.length} numéro{commandesAlert.length > 1 ? "s" : ""} de suivi à changer
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCommandesAlert(loadCommandesAChanger())}
                  className="text-primary/60 hover:text-primary transition-colors"
                  title="Rafraîchir"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => navigate("/suivi-commandes")}
                  className="flex items-center gap-1 text-xs text-primary/80 hover:text-primary font-medium transition-colors"
                >
                  Voir tout <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-primary/10">
              {commandesAlert.map(c => (
                <button
                  key={c.id}
                  onClick={() => navigate("/suivi-commandes")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary/10 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">N° ETSY</p>
                      <p className="text-xs font-mono font-medium truncate">{c.noEtsy || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Produit</p>
                      <p className="text-xs font-medium truncate">{c.refProduit || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Boutique</p>
                      <p className="text-xs truncate">{c.boutique || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">N° Tracktagos actuel</p>
                      <p className="text-xs font-mono truncate text-primary">{c.noTracktagos || "—"}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Tools */}
      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Outils Principaux</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <button
              key={tool.url}
              onClick={() => navigate(tool.url)}
              className="tool-card text-left group hover:glow-primary"
            >
              <tool.icon className={`h-8 w-8 ${tool.color} mb-3`} />
              <h3 className="font-display font-semibold text-foreground">{tool.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{tool.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Secondary Tools */}
      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {secondaryTools.map((tool) => (
            <button
              key={tool.url}
              onClick={() => navigate(tool.url)}
              className="tool-card text-left group hover:glow-primary"
            >
              <tool.icon className={`h-8 w-8 ${tool.color} mb-3`} />
              <h3 className="font-display font-semibold text-foreground">{tool.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{tool.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Google Sheets */}
      <section>
        <h2 className="font-display text-lg font-semibold mb-4">Google Sheets</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {sheets.map((sheet) => (
            <div key={sheet.title} className="tool-card group flex items-center gap-4">
              <button
                onClick={() => navigate(`/viewer?url=${encodeURIComponent(sheet.url)}&title=${encodeURIComponent(sheet.title)}`)}
                className="flex items-center gap-4 flex-1 text-left min-w-0"
              >
                <sheet.icon className="h-6 w-6 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="font-medium text-foreground truncate">{sheet.title}</span>
              </button>
              <a
                href={sheet.url}
                target="_blank"
                rel="noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors p-1 rounded"
                title="Ouvrir dans Google Sheets"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Create Boutique */}
      <section>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <FolderPlus className="h-4 w-4" />
              Création Boutique
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Créer une nouvelle boutique</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm text-muted-foreground mb-2 block">Nom de la boutique</label>
              <Input
                placeholder="Ma Boutique Etsy"
                value={newBoutiqueName}
                onChange={(e) => setNewBoutiqueName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Un dossier sera créé à la racine de votre Google Drive
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleCreateBoutique}>Créer le dossier</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
