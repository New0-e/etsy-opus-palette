import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Send, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { driveStore, type DriveFolder } from "@/lib/driveStore";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/eeea6c70-e494-4b2f-8fbf-0dee3337901b";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/eeea6c70-e494-4b2f-8fbf-0dee3337901b";

export default function CreationFichePage() {
  const [loading, setLoading] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [boutiques, setBoutiques] = useState<DriveFolder[]>([]);

  useEffect(() => {
    driveStore.fetchRootFolders().then(setBoutiques);
  }, []);

  const [form, setForm] = useState({
    etsy_lien: "",
    lien_ali: "",
    boutique_nom: "",
    categorie: "",
    nom_du_produit: "",
    fiche_numero: "",
    caracteristiques_instructions: "",
  });

  const update = (key: string, val: string) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(testMode ? WEBHOOK_TEST : WEBHOOK_PROD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Fiche produit créée avec succès !");
        setForm({ etsy_lien: "", lien_ali: "", boutique_nom: "", categorie: "", nom_du_produit: "", fiche_numero: "", caracteristiques_instructions: "" });
      } else {
        toast.error("Erreur lors de la création");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Génération Fiches Produits</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>
            Mode test
          </span>
          <Switch checked={testMode} onCheckedChange={setTestMode} />
        </div>
      </div>
      <form onSubmit={handleSubmit} className="tool-card space-y-5">
        <div className="space-y-2">
          <Label>Lien Etsy</Label>
          <Input placeholder="https://www.etsy.com/listing/..." value={form.etsy_lien} onChange={(e) => update("etsy_lien", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Lien Aliexpress</Label>
          <Input placeholder="https://www.aliexpress.com/item/..." value={form.lien_ali} onChange={(e) => update("lien_ali", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Boutique</Label>
          <Select value={form.boutique_nom} onValueChange={(v) => update("boutique_nom", v)}>
            <SelectTrigger><SelectValue placeholder="Sélectionner une boutique" /></SelectTrigger>
            <SelectContent>
              {boutiques.length === 0 && (
                <SelectItem value="__none" disabled>
                  {driveStore.getToken() ? "Aucun dossier trouvé" : "Connecte Drive pour voir les boutiques"}
                </SelectItem>
              )}
              {boutiques.map((b) => (
                <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Niche (Direction du titre)</Label>
          <Input value={form.categorie} onChange={(e) => update("categorie", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nom du Produit</Label>
            <Input value={form.nom_du_produit} onChange={(e) => update("nom_du_produit", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Numéro de Fiche</Label>
            <Input type="number" value={form.fiche_numero} onChange={(e) => update("fiche_numero", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Caractéristiques et Instructions</Label>
          <Textarea rows={4} placeholder="Décrivez les caractéristiques..." value={form.caracteristiques_instructions} onChange={(e) => update("caracteristiques_instructions", e.target.value)} />
        </div>
        <Button type="submit" className="w-full gap-2" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {loading ? "Envoi en cours..." : "Créer la fiche"}
        </Button>
      </form>
    </div>
  );
}
