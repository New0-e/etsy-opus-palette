import { useState, useEffect, useMemo, useRef } from "react";
import { driveStore } from "@/lib/driveStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, Upload, Loader2, FileText,
  Package, Clock, CheckCircle2, AlertTriangle, TrendingUp, RefreshCw, X, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

const STATUTS_COMMANDE = ["A traité", "Attente Expédition", "Expedier", "Livré", "Litige"] as const;
const STATUTS_TRACKTAGOS = ["A traité", "Attente 8H", "Numéro de Suivi à changer", "Terminé"] as const;
const MOIS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

type Commande = {
  id: string;
  createdAt: string;
  statutCommande: string;
  dateLimiteEnvoi: string;
  statutTracktagos: string;
  attente8HStartedAt: string;
  noEtsy: string;
  noAliexpress: string;
  noTracktagos: string;
  boutique: string;
  refProduit: string;
  variante: string;
  quantite: string;
  infoClient: string;
  docEtsyFileId: string;
  docEtsyFileName: string;
  prixProduit: string;
  prixLivraison: string;
  fraisEtsy: string;
  prixPayeClient: string;
  tauxImposition: string;
  estimationBenefice: string;
};

const EMPTY: Omit<Commande, "id" | "createdAt"> = {
  statutCommande: "", dateLimiteEnvoi: "", statutTracktagos: "", attente8HStartedAt: "",
  noEtsy: "", noAliexpress: "", noTracktagos: "", boutique: "",
  refProduit: "", variante: "", quantite: "", infoClient: "",
  docEtsyFileId: "", docEtsyFileName: "",
  prixProduit: "", prixLivraison: "", fraisEtsy: "", prixPayeClient: "",
  tauxImposition: "", estimationBenefice: "",
};

// ── Status styles ──────────────────────────────────────────────────────────────

const CMD_BADGE: Record<string, string> = {
  "A traité":            "bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600",
  "Attente Expédition":  "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700",
  "Expedier":            "bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  "Livré":               "bg-green-100 text-green-800 border border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
  "Litige":              "bg-red-100 text-red-800 border border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
};

const TRACK_BADGE: Record<string, string> = {
  "A traité":                    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  "Attente 8H":                  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  "Numéro de Suivi à changer":   "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "Terminé":                     "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

const ROW_BG: Record<string, string> = {
  "A traité":           "",
  "Attente Expédition": "bg-amber-50/50 dark:bg-amber-950/20",
  "Expedier":           "bg-blue-50/50 dark:bg-blue-950/20",
  "Livré":              "bg-green-50/40 dark:bg-green-950/20",
  "Litige":             "bg-red-50/50 dark:bg-red-950/20",
};

// ── Storage ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "suivi-commandes-v1";
const TAUX_KEY = "suivi-taux-imposition";
function loadCommandes(): Commande[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function saveCommandes(list: Commande[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function loadTaux(): string {
  return localStorage.getItem(TAUX_KEY) ?? "";
}
function saveTaux(t: string) {
  localStorage.setItem(TAUX_KEY, t);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcBenefBrut(f: Partial<Commande>): number {
  const n = (s?: string) => parseFloat(s ?? "") || 0;
  return n(f.prixPayeClient) - n(f.prixProduit) - n(f.prixLivraison) - n(f.fraisEtsy);
}

function calcBenef(f: Partial<Commande>): string {
  const brut = calcBenefBrut(f);
  if (isNaN(brut)) return "";
  const taux = parseFloat(f.tauxImposition ?? "") || 0;
  const net = taux > 0 ? brut * (1 - taux / 100) : brut;
  return net.toFixed(2);
}

function isEnRetard(c: Commande): boolean {
  if (!c.dateLimiteEnvoi || c.statutCommande === "Livré") return false;
  return new Date(c.dateLimiteEnvoi) < new Date(new Date().toDateString());
}

function fmt(n: string) {
  const v = parseFloat(n);
  return isNaN(v) ? "" : `${v.toFixed(2)} €`;
}

function formatCountdown(startedAt: string, now: number): { label: string; expired: boolean } {
  const elapsed = now - new Date(startedAt).getTime();
  const remaining = EIGHT_HOURS_MS - elapsed;
  if (remaining <= 0) return { label: "00:00:00", expired: true };
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1_000);
  return {
    label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
    expired: false,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? "bg-secondary text-muted-foreground";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${cls}`}>
      {value || "—"}
    </span>
  );
}

const NONE = "__none__";

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: readonly string[] | string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value || NONE} onValueChange={v => onChange(v === NONE ? "" : v)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} type={type}
        className="h-8 text-xs"
      />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SuiviCommandesPage() {
  const [commandes, setCommandes] = useState<Commande[]>(loadCommandes);
  const [now, setNow] = useState(() => Date.now());
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Commande, "id" | "createdAt">>({ ...EMPTY });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterStatut, setFilterStatut] = useState("all");
  const [filterBoutique, setFilterBoutique] = useState("all");
  const [search, setSearch] = useState("");
  const [shopList, setShopList] = useState<string[]>([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(String(new Date().getMonth() + 1));
  const [genYear] = useState(String(new Date().getFullYear()));
  const [generating, setGenerating] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editingTaux, setEditingTaux] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<string | null>(null);

  const fetchShops = async () => {
    if (!driveStore.isAuthorized()) return;
    setLoadingShops(true);
    const folders = await driveStore.fetchRootFolders();
    setShopList(folders.map(f => f.name).filter(n => n.toLowerCase() !== "stockage"));
    setLoadingShops(false);
  };

  useEffect(() => { fetchShops(); }, []);

  // Tick every second for countdown
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-transition "Attente 8H" → "Numéro de Suivi à changer" when 8h elapsed
  useEffect(() => {
    const toTransition = commandes.filter(
      c => c.statutTracktagos === "Attente 8H" &&
           c.attente8HStartedAt &&
           Date.now() - new Date(c.attente8HStartedAt).getTime() >= EIGHT_HOURS_MS
    );
    if (toTransition.length === 0) return;
    const ids = new Set(toTransition.map(c => c.id));
    const newList = commandes.map(c =>
      ids.has(c.id)
        ? { ...c, statutTracktagos: "Numéro de Suivi à changer", attente8HStartedAt: "" }
        : c
    );
    setCommandes(newList);
    saveCommandes(newList);
    toTransition.forEach(c =>
      toast.info(`Commande ${c.noEtsy || c.id.slice(0, 6)} → Numéro de Suivi à changer`)
    );
  }, [now, commandes]);

  // ── Computed ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return commandes.filter(c => {
      if (filterStatut !== "all" && c.statutCommande !== filterStatut) return false;
      if (filterBoutique !== "all" && c.boutique !== filterBoutique) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!c.noEtsy.toLowerCase().includes(s) &&
            !c.infoClient.toLowerCase().includes(s) &&
            !c.refProduit.toLowerCase().includes(s) &&
            !c.noAliexpress.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [commandes, filterStatut, filterBoutique, search]);

  const stats = useMemo(() => {
    const n = (v: string) => parseFloat(v) || 0;
    let totalCA = 0, totalBrut = 0, totalNet = 0;
    for (const c of commandes) {
      totalCA += n(c.prixPayeClient);
      const brut = n(c.prixPayeClient) - n(c.prixProduit) - n(c.prixLivraison) - n(c.fraisEtsy);
      totalBrut += brut;
      const taux = n(c.tauxImposition);
      totalNet += taux > 0 ? brut * (1 - taux / 100) : brut;
    }
    return {
      total: commandes.length,
      aTraiter: commandes.filter(c => c.statutCommande === "A traité").length,
      enCours: commandes.filter(c => c.statutCommande === "Attente Expédition" || c.statutCommande === "Expedier").length,
      livres: commandes.filter(c => c.statutCommande === "Livré").length,
      litiges: commandes.filter(c => c.statutCommande === "Litige").length,
      retard: commandes.filter(isEnRetard).length,
      totalCA,
      totalBrut,
      totalNet,
    };
  }, [commandes]);

  const boutiquesUsed = useMemo(() => {
    const set = new Set(commandes.map(c => c.boutique).filter(Boolean));
    return Array.from(set).sort();
  }, [commandes]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const patch = (key: keyof typeof form, val: string) => {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      if (key === "statutTracktagos") {
        if (val === "Attente 8H") {
          next.attente8HStartedAt = new Date().toISOString();
        } else {
          next.attente8HStartedAt = "";
        }
      }
      if (["prixPayeClient","prixProduit","prixLivraison","fraisEtsy","tauxImposition"].includes(key)) {
        next.estimationBenefice = calcBenef(next);
      }
      return next;
    });
  };

  const openAdd = () => {
    setEditId(null);
    setForm({ ...EMPTY, tauxImposition: loadTaux() });
    setEditingTaux(false);
    setModalOpen(true);
  };

  const openEdit = (c: Commande) => {
    setEditId(c.id);
    const { id: _i, createdAt: _c, ...rest } = c;
    setForm({ ...rest, tauxImposition: rest.tauxImposition || loadTaux() });
    setEditingTaux(false);
    setModalOpen(true);
  };

  const saveCommande = () => {
    const data = { ...form, estimationBenefice: calcBenef(form) || form.estimationBenefice };
    if (form.tauxImposition !== loadTaux()) saveTaux(form.tauxImposition);
    let newList: Commande[];
    if (editId) {
      newList = commandes.map(c => c.id === editId ? { ...c, ...data } : c);
      toast.success("Commande modifiée");
    } else {
      newList = [{ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...data }, ...commandes];
      toast.success("Commande ajoutée");
    }
    setCommandes(newList);
    saveCommandes(newList);
    setModalOpen(false);
  };

  const confirmDelete = (id: string) => setDeleteId(id);

  const doDelete = () => {
    if (!deleteId) return;
    const newList = commandes.filter(c => c.id !== deleteId);
    setCommandes(newList);
    saveCommandes(newList);
    setDeleteId(null);
    toast.success("Commande supprimée");
  };

  // ── Doc ETSY upload ────────────────────────────────────────────────────────

  const triggerDocUpload = (commandeId: string) => {
    uploadTargetId.current = commandeId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = uploadTargetId.current;
    if (!file || !targetId) return;
    e.target.value = "";

    if (!driveStore.isAuthorized()) {
      toast.error("Connectez-vous à Drive d'abord");
      return;
    }

    const commande = commandes.find(c => c.id === targetId);
    if (!commande) return;

    setUploadingId(targetId);
    try {
      const stockageId = await driveStore.resolveFolderPath(["Stockage"]);
      if (!stockageId) { toast.error("Dossier Stockage introuvable"); return; }
      const recapId = await driveStore.findOrCreateFolder("Document Recap Etsy", stockageId);
      if (!recapId) { toast.error("Dossier Document Recap Etsy introuvable"); return; }

      const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
      const finalName = (commande.noEtsy || file.name.replace(/\.[^/.]+$/, "")) + ext;
      const fileId = await driveStore.uploadFileToDrive(file, finalName, recapId);
      if (!fileId) { toast.error("Échec de l'upload"); return; }

      const newList = commandes.map(c =>
        c.id === targetId ? { ...c, docEtsyFileId: fileId, docEtsyFileName: finalName } : c
      );
      setCommandes(newList);
      saveCommandes(newList);
      toast.success("Document uploadé !");
    } finally {
      setUploadingId(null);
      uploadTargetId.current = null;
    }
  };

  // ── Generate monthly sheet ─────────────────────────────────────────────────

  const handleGenerateSheet = async () => {
    if (!driveStore.isAuthorized()) { toast.error("Connectez-vous à Drive d'abord"); return; }
    setGenerating(true);
    try {
      const monthName = MOIS[parseInt(genMonth) - 1];
      const monthIndex = parseInt(genMonth) - 1;
      const yearNum = parseInt(genYear);

      const stockageId = await driveStore.resolveFolderPath(["Stockage"]);
      if (!stockageId) { toast.error("Dossier Stockage introuvable dans Drive"); return; }
      const suiviId = await driveStore.findOrCreateFolder("Suivi commande", stockageId);
      if (!suiviId) { toast.error("Impossible de créer le dossier Suivi commande"); return; }
      const yearId = await driveStore.findOrCreateFolder(genYear, suiviId);
      if (!yearId) { toast.error("Impossible de créer le dossier année"); return; }
      const monthId = await driveStore.findOrCreateFolder(monthName, yearId);
      if (!monthId) { toast.error("Impossible de créer le dossier mois"); return; }
      const sheetId = await driveStore.createGSheet(`Suivi commandes - ${monthName} ${genYear}`, monthId);
      if (!sheetId) { toast.error("Impossible de créer le tableau"); return; }
      await driveStore.setupSuiviSheet(sheetId);

      // Filter commandes for the selected month/year (by createdAt)
      const monthCommandes = commandes.filter(c => {
        const d = new Date(c.createdAt);
        return d.getMonth() === monthIndex && d.getFullYear() === yearNum;
      });

      if (monthCommandes.length > 0) {
        const rows = monthCommandes.map(c => [
          c.statutCommande,
          c.dateLimiteEnvoi,
          c.statutTracktagos,
          c.noEtsy,
          c.noAliexpress,
          c.noTracktagos,
          c.boutique,
          c.refProduit,
          c.variante,
          c.quantite,
          c.infoClient,
          c.docEtsyFileName || "",
          c.prixProduit,
          c.prixLivraison,
          c.fraisEtsy,
          c.prixPayeClient,
          c.estimationBenefice,
        ]);
        await driveStore.writeSheetRows(sheetId, rows);
      }

      toast.success(
        `Tableau créé : Suivi commandes - ${monthName} ${genYear}` +
        (monthCommandes.length > 0 ? ` (${monthCommandes.length} commande${monthCommandes.length > 1 ? "s" : ""} exportée${monthCommandes.length > 1 ? "s" : ""})` : " (aucune commande ce mois)"),
        {
          action: {
            label: "Ouvrir",
            onClick: () => window.open(`https://docs.google.com/spreadsheets/d/${sheetId}`, "_blank"),
          },
        }
      );
      setGenOpen(false);
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-2xl font-bold">Suivi Commandes</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setGenOpen(true)}>
            <FileText className="h-3.5 w-3.5" />
            Générer feuille mensuelle
          </Button>
          <Button size="sm" className="gap-1.5 text-xs" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" />
            Nouvelle commande
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {[
          { label: "Total", value: stats.total, icon: Package, color: "text-foreground" },
          { label: "À traiter", value: stats.aTraiter, icon: Clock, color: "text-slate-500" },
          { label: "En cours", value: stats.enCours, icon: RefreshCw, color: "text-blue-500" },
          { label: "Livrés", value: stats.livres, icon: CheckCircle2, color: "text-green-500" },
          { label: "Litiges", value: stats.litiges, icon: AlertTriangle, color: "text-red-500" },
          { label: "En retard", value: stats.retard, icon: AlertTriangle, color: "text-amber-500" },
        ].map(card => (
          <div key={card.label} className="tool-card p-3 flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
              <span className="text-[10px] text-muted-foreground">{card.label}</span>
            </div>
            <span className={`text-xl font-bold ${card.color}`}>{card.value}</span>
          </div>
        ))}
      </div>

      {/* Financier — CA / Bénéfice brut / Bénéfice net */}
      <div className="grid grid-cols-3 gap-2">
        <div className="tool-card p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">CA total</span>
          </div>
          <span className="text-lg font-bold text-blue-500">{stats.totalCA.toFixed(2)} €</span>
          <span className="text-[10px] text-muted-foreground">Prix payés clients</span>
        </div>
        <div className="tool-card p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Bénéfice brut</span>
          </div>
          <span className={`text-lg font-bold ${stats.totalBrut >= 0 ? "text-amber-500" : "text-red-500"}`}>
            {stats.totalBrut.toFixed(2)} €
          </span>
          <span className="text-[10px] text-muted-foreground">Avant impôts</span>
        </div>
        <div className="tool-card p-3 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Bénéfice net</span>
          </div>
          <span className={`text-lg font-bold ${stats.totalNet >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {stats.totalNet.toFixed(2)} €
          </span>
          <span className="text-[10px] text-muted-foreground">Après impôts</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          placeholder="Rechercher N°ETSY, client, ref..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs w-48"
        />
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {STATUTS_COMMANDE.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterBoutique} onValueChange={setFilterBoutique}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes boutiques</SelectItem>
            {boutiquesUsed.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filterStatut !== "all" || filterBoutique !== "all" || search) && (
          <button
            onClick={() => { setFilterStatut("all"); setFilterBoutique("all"); setSearch(""); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <X className="h-3 w-3" /> Effacer filtres
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} commande{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="tool-card p-0 overflow-hidden flex-1 min-h-0">
        <div className="overflow-auto h-full">
          <table className="w-full text-xs border-collapse" style={{ minWidth: 1700 }}>
            <thead className="sticky top-0 z-10 bg-secondary/80 backdrop-blur">
              <tr>
                {[
                  "", "Statut commande", "Date limite", "Statut Tracktacos",
                  "N° ETSY", "N° Aliexpress", "N° Tracktagos", "Boutique",
                  "Ref Produit", "Variante", "Qté", "Info Client", "Doc ETSY",
                  "Prix Produit", "Livraison", "Frais Etsy", "Prix Payé", "Bénéfice net",
                ].map((h, i) => (
                  <th key={i} className="text-left px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={18} className="text-center py-12 text-muted-foreground text-xs">
                    Aucune commande. Cliquez sur « Nouvelle commande » pour commencer.
                  </td>
                </tr>
              )}
              {filtered.map(c => {
                const retard = isEnRetard(c);
                const rowBg = ROW_BG[c.statutCommande] ?? "";
                const countdown = c.statutTracktagos === "Attente 8H" && c.attente8HStartedAt
                  ? formatCountdown(c.attente8HStartedAt, now)
                  : null;
                return (
                  <tr key={c.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${rowBg}`}>
                    {/* Actions — à gauche */}
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(c)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Modifier">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={() => confirmDelete(c.id)} className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors" title="Supprimer">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    {/* Statut commande */}
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <StatusBadge value={c.statutCommande} map={CMD_BADGE} />
                    </td>
                    {/* Date limite */}
                    <td className={`px-2 py-1.5 whitespace-nowrap font-mono text-[10px] ${retard ? "text-red-500 font-semibold" : ""}`}>
                      {c.dateLimiteEnvoi || "—"}
                      {retard && <span className="ml-1 text-[9px] text-red-500">⚠ retard</span>}
                    </td>
                    {/* Statut Tracktacos */}
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <StatusBadge value={c.statutTracktagos} map={TRACK_BADGE} />
                      {countdown && (
                        <div className={`mt-0.5 font-mono text-[10px] font-semibold ${countdown.expired ? "text-orange-500" : "text-yellow-600 dark:text-yellow-400"}`}>
                          <Clock className="inline h-2.5 w-2.5 mr-0.5" />
                          {countdown.label}
                        </div>
                      )}
                    </td>
                    {/* N° ETSY */}
                    <td className="px-2 py-1.5 font-mono text-[10px] whitespace-nowrap">{c.noEtsy || "—"}</td>
                    {/* N° ALIEXPRESS */}
                    <td className="px-2 py-1.5 font-mono text-[10px] whitespace-nowrap">{c.noAliexpress || "—"}</td>
                    {/* N° TRACKTAGOS */}
                    <td className="px-2 py-1.5 font-mono text-[10px] whitespace-nowrap">{c.noTracktagos || "—"}</td>
                    {/* Boutique */}
                    <td className="px-2 py-1.5 whitespace-nowrap">{c.boutique || "—"}</td>
                    {/* Ref Produit */}
                    <td className="px-2 py-1.5 max-w-[90px] truncate" title={c.refProduit}>{c.refProduit || "—"}</td>
                    {/* Variante */}
                    <td className="px-2 py-1.5 max-w-[80px] truncate" title={c.variante}>{c.variante || "—"}</td>
                    {/* Quantité */}
                    <td className="px-2 py-1.5 text-center">{c.quantite || "—"}</td>
                    {/* Info Client */}
                    <td className="px-2 py-1.5 max-w-[110px] truncate" title={c.infoClient}>{c.infoClient || "—"}</td>
                    {/* Doc ETSY */}
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {c.docEtsyFileId ? (
                        <a
                          href={`https://drive.google.com/file/d/${c.docEtsyFileId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline text-[10px]"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          {c.docEtsyFileName || "Voir"}
                        </a>
                      ) : (
                        <button
                          onClick={() => triggerDocUpload(c.id)}
                          disabled={uploadingId === c.id}
                          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {uploadingId === c.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Upload className="h-3 w-3" />}
                          <span className="text-[10px]">Importer</span>
                        </button>
                      )}
                    </td>
                    {/* Prix Produit */}
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{fmt(c.prixProduit)}</td>
                    {/* Livraison */}
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{fmt(c.prixLivraison)}</td>
                    {/* Frais Etsy */}
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{fmt(c.fraisEtsy)}</td>
                    {/* Prix Payé */}
                    <td className="px-2 py-1.5 text-right whitespace-nowrap font-medium">{fmt(c.prixPayeClient)}</td>
                    {/* Bénéfice net */}
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {(() => {
                        const brut = calcBenefBrut(c);
                        const taux = parseFloat(c.tauxImposition) || 0;
                        const net = taux > 0 ? brut * (1 - taux / 100) : brut;
                        const color = net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500";
                        return (
                          <>
                            <div className={`font-semibold ${color}`}>{fmt(net.toFixed(2))}</div>
                            {taux > 0 && (
                              <div className="text-[9px] text-muted-foreground">
                                brut {fmt(brut.toFixed(2))} · {taux}%
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier la commande" : "Nouvelle commande"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Section statuts */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Statuts & Dates</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <SelectField label="Statut commande" value={form.statutCommande} options={STATUTS_COMMANDE} onChange={v => patch("statutCommande", v)} />
                <TextField label="Date limite envoi" value={form.dateLimiteEnvoi} onChange={v => patch("dateLimiteEnvoi", v)} type="date" />
                <SelectField label="Statut Tracktacos" value={form.statutTracktagos} options={STATUTS_TRACKTAGOS} onChange={v => patch("statutTracktagos", v)} />
              </div>
              {form.statutTracktagos === "Attente 8H" && form.attente8HStartedAt && (
                <div className="mt-2 flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    Compteur démarré à {new Date(form.attente8HStartedAt).toLocaleTimeString("fr-FR")} — transition auto dans{" "}
                    {formatCountdown(form.attente8HStartedAt, now).label}
                  </span>
                </div>
              )}
            </div>

            {/* Section numéros */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Numéros</p>
              <div className="grid grid-cols-3 gap-3">
                <TextField label="N° ETSY" value={form.noEtsy} onChange={v => patch("noEtsy", v)} placeholder="1234567890" />
                <TextField label="N° ALIEXPRESS" value={form.noAliexpress} onChange={v => patch("noAliexpress", v)} />
                <TextField label="N° TRACKTAGOS" value={form.noTracktagos} onChange={v => patch("noTracktagos", v)} />
              </div>
            </div>

            {/* Section produit */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Produit</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Boutique</Label>
                      {!loadingShops && shopList.length === 0 && (
                        <button onClick={fetchShops} className="text-[10px] text-muted-foreground hover:text-foreground">
                          <RefreshCw className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                    <Select value={form.boutique || NONE} onValueChange={v => patch("boutique", v === NONE ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={loadingShops ? "Chargement…" : "Choisir"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {shopList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <TextField label="Ref Produit" value={form.refProduit} onChange={v => patch("refProduit", v)} />
                <TextField label="Variante" value={form.variante} onChange={v => patch("variante", v)} />
                <TextField label="Quantité" value={form.quantite} onChange={v => patch("quantite", v)} placeholder="1" />
              </div>
            </div>

            {/* Section client */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Client</p>
              <div className="grid grid-cols-1 gap-3">
                <TextField label="Info Client" value={form.infoClient} onChange={v => patch("infoClient", v)} placeholder="Nom, adresse, notes..." />
              </div>
              {/* Doc ETSY — only on edit */}
              {editId && (
                <div className="mt-3 p-3 rounded-lg border border-border bg-secondary/20">
                  <Label className="text-xs block mb-2">Doc ETSY</Label>
                  {form.docEtsyFileName ? (
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span className="text-foreground">{form.docEtsyFileName}</span>
                      <button
                        onClick={() => { patch("docEtsyFileId", ""); patch("docEtsyFileName", ""); }}
                        className="text-muted-foreground hover:text-destructive ml-auto"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Uploadez le doc depuis le tableau directement (icône Import dans la colonne Doc ETSY).
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Section financier */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Financier</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <TextField label="Prix Produit (€)" value={form.prixProduit} onChange={v => patch("prixProduit", v)} placeholder="0.00" type="number" />
                <TextField label="Prix Livraison (€)" value={form.prixLivraison} onChange={v => patch("prixLivraison", v)} placeholder="0.00" type="number" />
                <TextField label="Frais Etsy (€)" value={form.fraisEtsy} onChange={v => patch("fraisEtsy", v)} placeholder="0.00" type="number" />
                <TextField label="Prix Payé client (€)" value={form.prixPayeClient} onChange={v => patch("prixPayeClient", v)} placeholder="0.00" type="number" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Taux d'imposition (%)</Label>
                  {editingTaux ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={form.tauxImposition}
                        onChange={e => patch("tauxImposition", e.target.value)}
                        placeholder="Ex: 30"
                        type="number"
                        min="0"
                        max="100"
                        className="h-8 text-xs"
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs px-2 shrink-0"
                        onClick={() => setEditingTaux(false)}
                      >
                        OK
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 h-8 px-2 rounded-md border border-border bg-secondary/30 text-xs">
                      <span className={form.tauxImposition ? "text-foreground font-medium" : "text-muted-foreground"}>
                        {form.tauxImposition ? `${form.tauxImposition}%` : "Non renseigné"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingTaux(true)}
                        className="ml-auto p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                        title="Modifier le taux"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">Mémorisé pour les prochaines commandes</p>
                </div>
                <div className="p-3 rounded-lg border border-border bg-secondary/20 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  <div>
                    <span className="text-xs text-muted-foreground">Bénéfice net estimé :</span>
                    <div className={`text-sm font-bold ${parseFloat(form.estimationBenefice) >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {form.estimationBenefice ? `${form.estimationBenefice} €` : "—"}
                    </div>
                    {form.tauxImposition && (
                      <span className="text-[10px] text-muted-foreground">après {form.tauxImposition}% d'impôts</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={saveCommande}>{editId ? "Enregistrer" : "Ajouter"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer la commande ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Cette action est irréversible.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button variant="destructive" onClick={doDelete}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate monthly sheet modal */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Générer feuille mensuelle</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-4">
            Crée un nouveau Google Sheet dans : <br />
            <span className="font-mono text-foreground">Drive / Stockage / Suivi commande / {genYear} / [Mois choisi]</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Mois</Label>
              <Select value={genMonth} onValueChange={setGenMonth}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOIS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Année</Label>
              <Input value={genYear} readOnly className="h-8 text-xs bg-secondary/50" />
            </div>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setGenOpen(false)}>Annuler</Button>
            <Button onClick={handleGenerateSheet} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {generating ? "Création en cours…" : "Créer le tableau"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
