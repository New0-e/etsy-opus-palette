import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Send, FlaskConical, Clock, CheckCheck, AlertCircle, X, RefreshCw, ListOrdered } from "lucide-react";
import { toast } from "sonner";
import { driveStore, type DriveFolder } from "@/lib/driveStore";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/eeea6c70-e494-4b2f-8fbf-0dee3337901b";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/eeea6c70-e494-4b2f-8fbf-0dee3337901b";

// ── Types ─────────────────────────────────────────────────────────────────────

type FormData = {
  etsy_lien: string;
  lien_ali: string;
  boutique_nom: string;
  categorie: string;
  nom_du_produit: string;
  fiche_numero: string;
  caracteristiques_instructions: string;
};

type QueueStatus = "pending" | "processing" | "done" | "error";

type QueueItem = {
  id: string;
  form: FormData;
  status: QueueStatus;
  label: string;
  testMode: boolean;
};

const EMPTY_FORM: FormData = {
  etsy_lien: "",
  lien_ali: "",
  boutique_nom: "",
  categorie: "",
  nom_du_produit: "",
  fiche_numero: "",
  caracteristiques_instructions: "",
};

// ── Queue row ─────────────────────────────────────────────────────────────────

function QueueRow({
  item,
  onRetry,
  onRemove,
}: {
  item: QueueItem;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const icon = {
    pending:    <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />,
    processing: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary flex-shrink-0" />,
    done:       <CheckCheck className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />,
    error:      <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />,
  }[item.status];

  const statusLabel = {
    pending:    "En attente",
    processing: "En cours…",
    done:       "Terminé",
    error:      "Erreur",
  }[item.status];

  const rowClass = {
    pending:    "border-border bg-secondary/30",
    processing: "border-primary/40 bg-primary/5",
    done:       "border-green-400/20 bg-green-400/5",
    error:      "border-destructive/20 bg-destructive/5",
  }[item.status];

  const statusColor = {
    pending:    "text-muted-foreground",
    processing: "text-primary",
    done:       "text-green-400",
    error:      "text-destructive",
  }[item.status];

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${rowClass}`}>
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{item.label}</p>
        <p className={`text-xs ${statusColor}`}>{statusLabel}</p>
      </div>
      {item.testMode && (
        <span className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
          test
        </span>
      )}
      <div className="flex items-center gap-1 flex-shrink-0">
        {item.status === "error" && (
          <button
            onClick={onRetry}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
            title="Réessayer"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        )}
        {item.status !== "processing" && (
          <button
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
            title="Retirer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CreationFichePage() {
  const [testMode, setTestMode] = useState(false);
  const [boutiques, setBoutiques] = useState<DriveFolder[]>([]);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const processingRef = useRef(false);

  useEffect(() => {
    driveStore.fetchRootFolders().then(setBoutiques);
  }, []);

  const update = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  // ── Queue processor ──────────────────────────────────────────────────────────
  // Fires whenever queue changes. Picks first "pending" item and processes it.
  // processingRef prevents concurrent processing.
  useEffect(() => {
    if (processingRef.current) return;
    const pending = queue.find(i => i.status === "pending");
    if (!pending) return;

    processingRef.current = true;
    setQueue(prev => prev.map(i => i.id === pending.id ? { ...i, status: "processing" } : i));

    const webhook = pending.testMode ? WEBHOOK_TEST : WEBHOOK_PROD;

    fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pending.form),
    })
      .then(r => {
        processingRef.current = false;
        const status: QueueStatus = r.ok ? "done" : "error";
        setQueue(prev => prev.map(i => i.id === pending.id ? { ...i, status } : i));
        if (r.ok) toast.success(`✓ "${pending.label}" créée avec succès !`);
        else toast.error(`Erreur lors de la création de "${pending.label}"`);
      })
      .catch(() => {
        processingRef.current = false;
        setQueue(prev => prev.map(i => i.id === pending.id ? { ...i, status: "error" } : i));
        toast.error(`Erreur de connexion — "${pending.label}"`);
      });
  }, [queue]);

  // ── Submit — adds to queue immediately, resets form ──────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const label = form.nom_du_produit.trim()
      || (form.fiche_numero ? `Fiche #${form.fiche_numero}` : "")
      || `Fiche ${queue.length + 1}`;
    const item: QueueItem = {
      id: crypto.randomUUID(),
      form: { ...form },
      status: "pending",
      label,
      testMode,
    };
    setQueue(prev => [...prev, item]);
    // Keep boutique + categorie for rapid chain submissions, reset the rest
    setForm(prev => ({
      ...EMPTY_FORM,
      boutique_nom: prev.boutique_nom,
      categorie: prev.categorie,
    }));
    toast.info(`"${label}" ajouté à la file`);
  };

  const retryItem = (id: string) => {
    setQueue(prev => prev.map(i => i.id === id ? { ...i, status: "pending" } : i));
  };

  const removeItem = (id: string) => {
    setQueue(prev => prev.filter(i => i.id !== id));
  };

  const clearDone = () => {
    setQueue(prev => prev.filter(i => i.status !== "done" && i.status !== "error"));
  };

  const pendingCount  = queue.filter(i => i.status === "pending").length;
  const isProcessing  = queue.some(i => i.status === "processing");
  const hasDoneOrErr  = queue.some(i => i.status === "done" || i.status === "error");
  const totalInFlight = queue.filter(i => i.status !== "done").length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="tool-card space-y-5">
        <div className="space-y-2">
          <Label>Lien Etsy</Label>
          <Input
            placeholder="https://www.etsy.com/listing/..."
            value={form.etsy_lien}
            onChange={e => update("etsy_lien", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Lien Aliexpress</Label>
          <Input
            placeholder="https://www.aliexpress.com/item/..."
            value={form.lien_ali}
            onChange={e => update("lien_ali", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Boutique</Label>
          <Select value={form.boutique_nom} onValueChange={v => update("boutique_nom", v)}>
            <SelectTrigger><SelectValue placeholder="Sélectionner une boutique" /></SelectTrigger>
            <SelectContent>
              {boutiques.length === 0 && (
                <SelectItem value="__none" disabled>
                  {driveStore.getToken() ? "Aucun dossier trouvé" : "Connecte Drive pour voir les boutiques"}
                </SelectItem>
              )}
              {boutiques.map(b => (
                <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Niche (Direction du titre)</Label>
          <Input value={form.categorie} onChange={e => update("categorie", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nom du Produit</Label>
            <Input value={form.nom_du_produit} onChange={e => update("nom_du_produit", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Numéro de Fiche</Label>
            <Input type="number" value={form.fiche_numero} onChange={e => update("fiche_numero", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Caractéristiques et Instructions</Label>
          <Textarea
            rows={4}
            placeholder="Décrivez les caractéristiques..."
            value={form.caracteristiques_instructions}
            onChange={e => update("caracteristiques_instructions", e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full gap-2">
          <Send className="h-4 w-4" />
          {totalInFlight > 0
            ? `Ajouter à la file — ${totalInFlight} en attente`
            : "Créer la fiche"}
        </Button>
      </form>

      {/* ── Queue ── */}
      {queue.length > 0 && (
        <div className="mt-6 tool-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">File d'attente</h2>
              {isProcessing && (
                <span className="flex items-center gap-1 text-xs text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  En cours…
                </span>
              )}
              {!isProcessing && pendingCount > 0 && (
                <span className="text-xs text-muted-foreground">{pendingCount} en attente</span>
              )}
            </div>
            {hasDoneOrErr && (
              <button
                onClick={clearDone}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Effacer terminés
              </button>
            )}
          </div>
          <div className="space-y-2">
            {queue.map(item => (
              <QueueRow
                key={item.id}
                item={item}
                onRetry={() => retryItem(item.id)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
