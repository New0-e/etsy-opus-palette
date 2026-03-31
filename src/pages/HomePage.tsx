import { FileText, ImageDown, Camera, ExternalLink, Table2, Store, Package, FolderPlus, Tags, BarChart3, UserSearch } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

const tools = [
  { title: "Génération Fiches Produits", desc: "Créer une nouvelle fiche produit Etsy", icon: FileText, url: "/creation-fiche", color: "text-primary" },
  { title: "Téléchargement Images", desc: "Télécharger les images scrapées", icon: ImageDown, url: "/download-images", color: "text-success" },
  { title: "Génération Images", desc: "Générer des images produit avec IA", icon: Camera, url: "/generation-photos", color: "text-warning" },
];

const secondaryTools = [
  { title: "Analyse Image → Tags", desc: "Extraire les tags depuis une image", icon: Tags, url: "/analyse-image", color: "text-blue-400" },
  { title: "Analyse Tags", desc: "Analyser et optimiser vos tags", icon: BarChart3, url: "/analyse-tags", color: "text-purple-400" },
  { title: "Tags Concurrent", desc: "Espionner les tags des concurrents", icon: UserSearch, url: "/tags-concurrent", color: "text-pink-400" },
];

const sheets = [
  { title: "Tableau Contrôle", icon: Table2, url: "https://docs.google.com/spreadsheets/d/1u3_-YtIYqCnO2YEPfLh1cCsjd2CcRiT1cKileCLA0Ig/edit?gid=0#gid=0" },
  { title: "Liste Boutique", icon: Store, url: "https://docs.google.com/spreadsheets/d/1cetIf0cfWDxz-geTmatUOBchdjUUpCvS/edit?gid=1536179428#gid=1536179428" },
  { title: "Suivi Commande", icon: Package, url: "https://docs.google.com/spreadsheets/d/1exMlQ6dnfIGF7xsgUJskk57IRypVK29E/edit?gid=513162334#gid=513162334" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [newBoutiqueName, setNewBoutiqueName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

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
        <p className="text-muted-foreground mt-1">Gérez vos boutiques et produits Etsy</p>
      </div>

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
        <h2 className="font-display text-lg font-semibold mb-4">Outils Secondaires</h2>
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
            <button
              key={sheet.title}
              onClick={() => window.open(sheet.url, "_blank")}
              className="tool-card text-left group flex items-center gap-4"
            >
              <sheet.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="font-medium text-foreground">{sheet.title}</span>
              <ExternalLink className="h-4 w-4 text-muted-foreground ml-auto" />
            </button>
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
