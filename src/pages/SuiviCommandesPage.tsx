import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { driveStore } from "@/lib/driveStore";
import { saveToDrive, loadFromDrive, clearDriveCache } from "@/lib/suiviSync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, Upload, Loader2, FileText,
  Package, Clock, CheckCircle2, AlertTriangle, TrendingUp, RefreshCw, X, ExternalLink,
  BarChart2, ArrowUpRight, ArrowDownRight, ShoppingBag, Star, Target, Minus,
  Link2, ArrowUpDown, Cloud, CloudOff, Download, Copy,
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
  "Numéro de Suivi à changer":   "bg-violet-100 text-violet-800 border border-violet-300 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700",
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
const LOCAL_SAVED_KEY = "suivi-local-last-saved";
function loadCommandes(): Commande[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function saveCommandes(list: Commande[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  localStorage.setItem(LOCAL_SAVED_KEY, new Date().toISOString());
}
function loadTaux(): string {
  return localStorage.getItem(TAUX_KEY) ?? "";
}
function saveTaux(t: string) {
  localStorage.setItem(TAUX_KEY, t);
}

// linked sheets : { "2026-04": "sheetId", "2026-03": "sheetId", ... }
const LINKED_SHEETS_KEY = "suivi-linked-sheets";
function loadLinkedSheets(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LINKED_SHEETS_KEY) ?? "{}"); } catch { return {}; }
}
function saveLinkedSheets(map: Record<string, string>) {
  localStorage.setItem(LINKED_SHEETS_KEY, JSON.stringify(map));
}
function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MOIS[parseInt(month) - 1]} ${year}`;
}
function extractSheetId(input: string): string {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : input.trim();
}

function commandeToRow(c: Commande): string[] {
  return [
    c.statutCommande, c.dateLimiteEnvoi, c.statutTracktagos,
    c.noEtsy, c.noAliexpress, c.noTracktagos, c.boutique,
    c.refProduit, c.variante, c.quantite, c.infoClient,
    c.docEtsyFileName || "", c.prixProduit, c.prixLivraison,
    c.fraisEtsy, c.prixPayeClient, c.estimationBenefice,
  ];
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

const TRACKTAGOS_NON_RETARD = ["Attente 8H", "Numéro de Suivi à changer", "Terminé"];

function localDateISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function localDateOffsetISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isEnRetard(c: Commande): boolean {
  if (!c.dateLimiteEnvoi || c.statutCommande === "Livré") return false;
  if (TRACKTAGOS_NON_RETARD.includes(c.statutTracktagos)) return false;
  return c.dateLimiteEnvoi < localDateISO();
}

function isAujourdhuiLimite(c: Commande): boolean {
  if (!c.dateLimiteEnvoi || c.statutCommande === "Livré") return false;
  if (TRACKTAGOS_NON_RETARD.includes(c.statutTracktagos)) return false;
  return c.dateLimiteEnvoi === localDateISO();
}

function isProcheDateLimite(c: Commande): boolean {
  if (!c.dateLimiteEnvoi || c.statutCommande === "Livré") return false;
  if (TRACKTAGOS_NON_RETARD.includes(c.statutTracktagos)) return false;
  return c.dateLimiteEnvoi === localDateOffsetISO(1);
}

function fmt(n: string) {
  const v = parseFloat(n);
  return isNaN(v) ? "" : `${v.toFixed(2)} €`;
}

function exportCSV(commandes: Commande[]) {
  const headers = [
    "Statut commande","Date limite","Statut Tracktagos","N° Etsy","N° Aliexpress","N° Tracktagos",
    "Boutique","Ref produit","Variante","Quantité","Info client",
    "Prix produit","Prix livraison","Frais Etsy","Prix payé client","Bénéfice estimé","Créé le",
  ];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = commandes.map(c => [
    c.statutCommande, c.dateLimiteEnvoi, c.statutTracktagos,
    c.noEtsy, c.noAliexpress, c.noTracktagos, c.boutique,
    c.refProduit, c.variante, c.quantite, c.infoClient,
    c.prixProduit, c.prixLivraison, c.fraisEtsy, c.prixPayeClient,
    c.estimationBenefice, c.createdAt,
  ].map(esc).join(","));
  const csv = [headers.map(esc).join(","), ...rows].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `commandes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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

function InlineStatusSelect({ value, options, map, onChange }: {
  value: string; options: readonly string[]; map: Record<string, string>;
  onChange: (v: string) => void;
}) {
  const cls = map[value] ?? "bg-secondary text-muted-foreground";
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`appearance-none cursor-pointer px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap border-0 outline-none pr-4 ${cls}`}
        style={{ backgroundImage: "none" }}
      >
        {options.map(o => (
          <option key={o} value={o} style={{ backgroundColor: "#1e2130", color: "#e8eaf0" }}>{o}</option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[8px] opacity-60">▼</span>
    </div>
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

function InlineTextInput({ value, onChange, placeholder = "—" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); inputRef.current?.blur(); } if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className="w-full font-mono text-[10px] bg-secondary/60 border border-primary/40 rounded px-1 py-0.5 outline-none focus:border-primary"
        style={{ minWidth: 60 }}
        autoFocus
      />
    );
  }

  return (
    <div
      className="flex items-center gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="font-mono text-[10px] text-left hover:text-primary transition-colors truncate flex-1"
        title={value || placeholder}
      >
        {value || <span className="text-muted-foreground/40">{placeholder}</span>}
      </button>
      {hovered && value && (
        <button
          onClick={handleCopy}
          className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-primary transition-colors"
          title="Copier"
        >
          {copied
            ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
            : <Copy className="h-2.5 w-2.5" />}
        </button>
      )}
    </div>
  );
}

function CopyCell({ value, placeholder = "—" }: { value: string; placeholder?: string }) {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className="relative flex items-center gap-1 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="font-mono text-[10px] truncate">{value || <span className="text-muted-foreground/40">{placeholder}</span>}</span>
      {hovered && value && (
        <button
          onClick={handleCopy}
          className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-primary transition-colors"
          title="Copier"
        >
          {copied
            ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
            : <Copy className="h-2.5 w-2.5" />}
        </button>
      )}
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

// ── Stats helpers ──────────────────────────────────────────────────────────────

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

function buildMonthlyStats(commandes: Commande[]) {
  const map = new Map<string, { label: string; ca: number; brut: number; net: number; count: number }>();
  const now = new Date();
  // Init last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    map.set(key, { label: MOIS[d.getMonth()].slice(0, 3) + " " + String(d.getFullYear()).slice(2), ca: 0, brut: 0, net: 0, count: 0 });
  }
  for (const c of commandes) {
    const d = new Date(c.createdAt);
    const key = monthKey(d);
    if (!map.has(key)) continue;
    const n = (v: string) => parseFloat(v) || 0;
    const ca = n(c.prixPayeClient);
    const brut = ca - n(c.prixProduit) - n(c.prixLivraison) - n(c.fraisEtsy);
    const taux = n(c.tauxImposition);
    const net = taux > 0 ? brut * (1 - taux / 100) : brut;
    const m = map.get(key)!;
    m.ca += ca; m.brut += brut; m.net += net; m.count++;
  }
  return Array.from(map.values());
}

function buildBoutiqueStats(commandes: Commande[]) {
  const map = new Map<string, { ca: number; brut: number; count: number; livres: number }>();
  for (const c of commandes) {
    const b = c.boutique || "—";
    if (!map.has(b)) map.set(b, { ca: 0, brut: 0, count: 0, livres: 0 });
    const n = (v: string) => parseFloat(v) || 0;
    const ca = n(c.prixPayeClient);
    const brut = ca - n(c.prixProduit) - n(c.prixLivraison) - n(c.fraisEtsy);
    const m = map.get(b)!;
    m.ca += ca; m.brut += brut; m.count++;
    if (c.statutCommande === "Livré") m.livres++;
  }
  return Array.from(map.entries())
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => b.ca - a.ca);
}

function Trend({ curr, prev }: { curr: number; prev: number }) {
  if (!prev) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${up ? "text-emerald-500" : "text-red-500"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function MiniBar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 2;
  return (
    <div className="w-full bg-secondary rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StatsDialog({ open, onClose, commandes }: { open: boolean; onClose: () => void; commandes: Commande[] }) {
  const now = new Date();
  const curKey = monthKey(now);
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = monthKey(prevDate);

  const monthly = useMemo(() => buildMonthlyStats(commandes), [commandes]);
  const boutiqueStats = useMemo(() => buildBoutiqueStats(commandes), [commandes]);

  const cur = monthly.find(m => {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return m.label === MOIS[d.getMonth()].slice(0, 3) + " " + String(d.getFullYear()).slice(2);
  }) ?? { ca: 0, brut: 0, net: 0, count: 0 };
  const prev = monthly.find(m => {
    return m.label === MOIS[prevDate.getMonth()].slice(0, 3) + " " + String(prevDate.getFullYear()).slice(2);
  }) ?? { ca: 0, brut: 0, net: 0, count: 0 };

  const n = (v: string) => parseFloat(v) || 0;

  // Année en cours
  const yearCommandes = commandes.filter(c => new Date(c.createdAt).getFullYear() === now.getFullYear());
  const yearCA = yearCommandes.reduce((s, c) => s + n(c.prixPayeClient), 0);
  const yearBrut = yearCommandes.reduce((s, c) => s + n(c.prixPayeClient) - n(c.prixProduit) - n(c.prixLivraison) - n(c.fraisEtsy), 0);
  const yearNet = yearCommandes.reduce((s, c) => {
    const brut = n(c.prixPayeClient) - n(c.prixProduit) - n(c.prixLivraison) - n(c.fraisEtsy);
    const taux = n(c.tauxImposition);
    return s + (taux > 0 ? brut * (1 - taux / 100) : brut);
  }, 0);

  const totalCommandes = commandes.length;
  const panierMoyen = totalCommandes > 0 ? commandes.reduce((s, c) => s + n(c.prixPayeClient), 0) / totalCommandes : 0;
  const tauxLivraison = totalCommandes > 0 ? (commandes.filter(c => c.statutCommande === "Livré").length / totalCommandes) * 100 : 0;
  const tauxLitige = totalCommandes > 0 ? (commandes.filter(c => c.statutCommande === "Litige").length / totalCommandes) * 100 : 0;
  const tauxRetard = totalCommandes > 0 ? (commandes.filter(isEnRetard).length / totalCommandes) * 100 : 0;

  const maxCA = Math.max(...monthly.map(m => m.ca), 1);
  const maxBar = Math.max(...boutiqueStats.map(b => b.ca), 1);

  const statusDist = [
    { label: "À traiter", count: commandes.filter(c => c.statutCommande === "A traité").length, color: "bg-slate-400" },
    { label: "Attente Exp.", count: commandes.filter(c => c.statutCommande === "Attente Expédition").length, color: "bg-amber-400" },
    { label: "Expédié", count: commandes.filter(c => c.statutCommande === "Expedier").length, color: "bg-blue-400" },
    { label: "Livré", count: commandes.filter(c => c.statutCommande === "Livré").length, color: "bg-emerald-400" },
    { label: "Litige", count: commandes.filter(c => c.statutCommande === "Litige").length, color: "bg-red-400" },
  ];
  const maxStatus = Math.max(...statusDist.map(s => s.count), 1);

  const prodStats = useMemo(() => {
    const map = new Map<string, { count: number; ca: number }>();
    for (const c of commandes) {
      const key = c.refProduit || "—";
      if (!map.has(key)) map.set(key, { count: 0, ca: 0 });
      const m = map.get(key)!;
      m.count += parseInt(c.quantite) || 1;
      m.ca += n(c.prixPayeClient);
    }
    return Array.from(map.entries()).map(([ref, s]) => ({ ref, ...s })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [commandes]);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            Tableau de bord — Statistiques globales
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pb-2">

          {/* ── Mois en cours vs précédent ── */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {MOIS[now.getMonth()]} {now.getFullYear()} vs {MOIS[prevDate.getMonth()]} {prevDate.getFullYear()}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "CA du mois", cur: cur.ca, prev: prev.ca, color: "text-blue-500", fmt: (v: number) => `${v.toFixed(2)} €` },
                { label: "Bénéfice brut", cur: cur.brut, prev: prev.brut, color: "text-amber-500", fmt: (v: number) => `${v.toFixed(2)} €` },
                { label: "Bénéfice net", cur: cur.net, prev: prev.net, color: "text-emerald-500", fmt: (v: number) => `${v.toFixed(2)} €` },
                { label: "Commandes", cur: cur.count, prev: prev.count, color: "text-violet-500", fmt: (v: number) => String(v) },
              ].map(card => (
                <div key={card.label} className="tool-card p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">{card.label}</p>
                  <p className={`text-base font-bold ${card.color}`}>{card.fmt(card.cur)}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{card.fmt(card.prev)}</span>
                    <Trend curr={card.cur} prev={card.prev} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Année en cours ── */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Année {now.getFullYear()} — {yearCommandes.length} commande{yearCommandes.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="tool-card p-3">
                <p className="text-[10px] text-muted-foreground mb-1">CA annuel</p>
                <p className="text-lg font-bold text-blue-500">{yearCA.toFixed(2)} €</p>
                <p className="text-[10px] text-muted-foreground">Panier moyen {panierMoyen.toFixed(2)} €</p>
              </div>
              <div className="tool-card p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Bénéfice brut annuel</p>
                <p className={`text-lg font-bold ${yearBrut >= 0 ? "text-amber-500" : "text-red-500"}`}>{yearBrut.toFixed(2)} €</p>
                <p className="text-[10px] text-muted-foreground">
                  Marge {yearCA > 0 ? ((yearBrut / yearCA) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="tool-card p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Bénéfice net annuel</p>
                <p className={`text-lg font-bold ${yearNet >= 0 ? "text-emerald-500" : "text-red-500"}`}>{yearNet.toFixed(2)} €</p>
                <p className="text-[10px] text-muted-foreground">
                  Net/CA {yearCA > 0 ? ((yearNet / yearCA) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </div>
          </div>

          {/* ── Évolution mensuelle (12 mois) ── */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Évolution CA — 12 derniers mois</p>
            <div className="tool-card p-4">
              <div className="flex items-end gap-1 h-24">
                {monthly.map((m, i) => {
                  const isCurrent = i === monthly.length - 1;
                  const h = maxCA > 0 ? Math.max(4, (m.ca / maxCA) * 100) : 4;
                  return (
                    <div key={m.label} className="flex flex-col items-center flex-1 gap-1" title={`${m.label} : ${m.ca.toFixed(2)} €`}>
                      <span className="text-[8px] text-muted-foreground">{m.ca > 0 ? `${m.ca.toFixed(0)}€` : ""}</span>
                      <div
                        className={`w-full rounded-t transition-all ${isCurrent ? "bg-blue-500" : "bg-blue-300/60 dark:bg-blue-800/50"}`}
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1 mt-1">
                {monthly.map(m => (
                  <div key={m.label} className="flex-1 text-center">
                    <span className="text-[8px] text-muted-foreground">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Boutiques + Qualité ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Top boutiques */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <ShoppingBag className="h-3 w-3" /> Top boutiques (par CA)
              </p>
              <div className="tool-card p-3 space-y-2">
                {boutiqueStats.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Aucune donnée</p>
                )}
                {boutiqueStats.slice(0, 6).map((b, i) => (
                  <div key={b.name}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        {i === 0 && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                        <span className="font-medium truncate max-w-[120px]">{b.name}</span>
                        <span className="text-muted-foreground text-[10px]">{b.count} cmd</span>
                      </span>
                      <span className="font-semibold text-blue-500">{b.ca.toFixed(2)} €</span>
                    </div>
                    <MiniBar value={b.ca} max={maxBar} color="bg-blue-400" />
                  </div>
                ))}
              </div>
            </div>

            {/* Qualité */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Target className="h-3 w-3" /> Qualité & Santé
              </p>
              <div className="tool-card p-3 space-y-3">
                {[
                  { label: "Taux de livraison", value: tauxLivraison, color: "bg-emerald-400", good: true },
                  { label: "Taux de litige", value: tauxLitige, color: "bg-red-400", good: false },
                  { label: "Taux de retard", value: tauxRetard, color: "bg-amber-400", good: false },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className={`font-semibold ${row.good ? (row.value >= 80 ? "text-emerald-500" : "text-amber-500") : (row.value === 0 ? "text-emerald-500" : row.value < 5 ? "text-amber-500" : "text-red-500")}`}>
                        {row.value.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className={`${row.color} h-2 rounded-full`} style={{ width: `${Math.min(row.value, 100)}%` }} />
                    </div>
                  </div>
                ))}
                <div className="pt-1 border-t border-border grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Panier moyen", value: `${panierMoyen.toFixed(2)} €` },
                    { label: "Total commandes", value: String(totalCommandes) },
                    { label: "En cours", value: String(commandes.filter(c => ["Attente Expédition","Expedier"].includes(c.statutCommande)).length) },
                  ].map(item => (
                    <div key={item.label}>
                      <p className="text-sm font-bold">{item.value}</p>
                      <p className="text-[9px] text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Répartition statuts + Top produits ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Statuts */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Répartition par statut</p>
              <div className="tool-card p-3 space-y-2">
                {statusDist.map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-muted-foreground">{s.label}</span>
                      <span className="font-semibold">
                        {s.count}
                        {totalCommandes > 0 && <span className="text-muted-foreground font-normal ml-1">({((s.count / totalCommandes) * 100).toFixed(0)}%)</span>}
                      </span>
                    </div>
                    <MiniBar value={s.count} max={maxStatus} color={s.color} />
                  </div>
                ))}
              </div>
            </div>

            {/* Top produits */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-3">Top 5 produits (quantité)</p>
              <div className="tool-card p-3 space-y-2">
                {prodStats.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Aucune donnée</p>}
                {prodStats.map((p, i) => (
                  <div key={p.ref} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                    <span className="flex-1 truncate font-medium" title={p.ref}>{p.ref}</span>
                    <span className="text-violet-500 font-semibold shrink-0">{p.count} unité{p.count > 1 ? "s" : ""}</span>
                    <span className="text-muted-foreground text-[10px] shrink-0">{p.ca.toFixed(0)} €</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [filterTracktagos, setFilterTracktagos] = useState("all");
  const [search, setSearch] = useState("");
  const [shopList, setShopList] = useState<string[]>([]);
  const [loadingShops, setLoadingShops] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(String(new Date().getMonth() + 1));
  const [genYear] = useState(String(new Date().getFullYear()));
  const [generating, setGenerating] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editingTaux, setEditingTaux] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [sortBy, setSortBy] = useState<"none" | "dateLimite">("none");
  const [filterMonth, setFilterMonth] = useState("all");
  const [linkedSheets, setLinkedSheets] = useState<Record<string, string>>(() => loadLinkedSheets());
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({});
  // key = nom de l'onglet (boutique), value = liste de produits
  const [produitsBoutique, setProduitsBoutique] = useState<Record<string, { num: string; nom: string }[]>>({});
  const [loadingProduits, setLoadingProduits] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const driveSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Déclenche une sync Drive 2s après le dernier changement (debounce)
  const scheduleDriveSync = useCallback((
    nextCommandes: Commande[],
    nextLinked: Record<string, string>,
    nextTaux: string
  ) => {
    if (!driveStore.isAuthorized()) return;
    if (driveSyncTimer.current) clearTimeout(driveSyncTimer.current);
    setSyncStatus("syncing");
    driveSyncTimer.current = setTimeout(async () => {
      const ok = await saveToDrive({
        commandes: nextCommandes,
        linkedSheets: nextLinked,
        tauxImposition: nextTaux,
      });
      setSyncStatus(ok ? "ok" : "error");
    }, 2000);
  }, []);

  const fetchShops = async () => {
    if (!driveStore.isAuthorized()) return;
    setLoadingShops(true);
    const folders = await driveStore.fetchRootFolders();
    setShopList(folders.map(f => f.name).filter(n => n.toLowerCase() !== "stockage" && !n.startsWith(".")));
    setLoadingShops(false);
  };

  const fetchProduits = async () => {
    if (!driveStore.isAuthorized()) return;
    setLoadingProduits(true);
    try {
      const file = await driveStore.findFileByName("Liste Boutique", "application/vnd.google-apps.spreadsheet");
      if (!file) return;
      const tabs = await driveStore.getSheetTabs(file.id);
      if (!tabs) return;
      const result: Record<string, { num: string; nom: string }[]> = {};
      for (const tab of tabs) {
        const values = await driveStore.readSheetValues(file.id, `'${tab.title}'!A2:B1000`);
        if (!values) continue;
        result[tab.title] = values
          .filter(row => row[0] || row[1])
          .map(row => ({ num: row[0] ?? "", nom: row[1] ?? "" }));
      }
      setProduitsBoutique(result);
    } finally {
      setLoadingProduits(false);
    }
  };

  const syncLinkedSheet = async (monthKey: string, allCommandes: Commande[]) => {
    const sheetId = loadLinkedSheets()[monthKey];
    if (!sheetId || !driveStore.isAuthorized()) return;
    const monthCommandes = allCommandes.filter(c => getMonthKey(c.createdAt) === monthKey);
    const ok = await driveStore.syncSheetRows(sheetId, monthCommandes.map(commandeToRow));
    if (!ok) toast.warning(`Synchro ${monthLabel(monthKey)} échouée`, { duration: 4000 });
  };

  useEffect(() => {
    fetchShops();
    fetchProduits();

    // Charge depuis Drive au démarrage — si Drive est plus récent que localStorage, on l'utilise
    if (driveStore.isAuthorized()) {
      loadFromDrive().then(remote => {
        if (!remote) return;
        const localRaw = localStorage.getItem("suivi-commandes-v1");
        const localCommandes: Commande[] = localRaw ? JSON.parse(localRaw) : [];
        // Compare les timestamps : prend la source la plus récente
        const localLastSavedStr = localStorage.getItem(LOCAL_SAVED_KEY);
        const localLastSaved = localLastSavedStr ? new Date(localLastSavedStr).getTime() : 0;
        const remoteLastSaved = new Date(remote.lastSaved).getTime();

        if (remoteLastSaved > localLastSaved || localCommandes.length === 0) {
          // Drive est plus récent → on écrase le localStorage et on met à jour l'UI
          localStorage.setItem("suivi-commandes-v1", JSON.stringify(remote.commandes));
          localStorage.setItem("suivi-linked-sheets", JSON.stringify(remote.linkedSheets));
          localStorage.setItem(LOCAL_SAVED_KEY, remote.lastSaved);
          if (remote.tauxImposition) localStorage.setItem("suivi-taux-imposition", remote.tauxImposition);
          setCommandes(remote.commandes);
          setLinkedSheets(remote.linkedSheets);
          setSyncStatus("ok");
          toast.success("Données synchronisées depuis Google Drive", { duration: 3000 });
        } else {
          setSyncStatus("ok");
        }
      }).catch(() => setSyncStatus("idle"));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (modalOpen || genOpen || linkOpen || statsOpen || deleteId) return;
      if (e.key === "n") { e.preventDefault(); openAdd(); }
      if (e.key === "f") { e.preventDefault(); searchInputRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, genOpen, linkOpen, statsOpen, deleteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed ───────────────────────────────────────────────────────────────

  const monthsUsed = useMemo(() => {
    const set = new Set(commandes.map(c => getMonthKey(c.createdAt)));
    return Array.from(set).sort().reverse();
  }, [commandes]);

  const filtered = useMemo(() => {
    return commandes.filter(c => {
      if (filterMonth !== "all" && getMonthKey(c.createdAt) !== filterMonth) return false;
      if (filterStatut !== "all" && c.statutCommande !== filterStatut) return false;
      if (filterBoutique !== "all" && c.boutique !== filterBoutique) return false;
      if (filterTracktagos !== "all" && c.statutTracktagos !== filterTracktagos) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!c.noEtsy.toLowerCase().includes(s) &&
            !c.infoClient.toLowerCase().includes(s) &&
            !c.refProduit.toLowerCase().includes(s) &&
            !c.noAliexpress.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [commandes, filterMonth, filterStatut, filterBoutique, filterTracktagos, search]);

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

  const currentMonthKey = getMonthKey(new Date().toISOString());
  const currentMonthSheetId = linkedSheets[currentMonthKey] ?? "";

  const displayed = useMemo(() => {
    if (sortBy !== "dateLimite") return filtered;
    return [...filtered].sort((a, b) => {
      if (!a.dateLimiteEnvoi) return 1;
      if (!b.dateLimiteEnvoi) return -1;
      return a.dateLimiteEnvoi.localeCompare(b.dateLimiteEnvoi);
    });
  }, [filtered, sortBy]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const updateFieldInline = (id: string, key: keyof Commande, val: string) => {
    const newList = commandes.map(c => c.id !== id ? c : { ...c, [key]: val });
    setCommandes(newList);
    saveCommandes(newList);
    scheduleDriveSync(newList, linkedSheets, loadTaux());
    const monthKey = getMonthKey(commandes.find(c => c.id === id)?.createdAt ?? new Date().toISOString());
    syncLinkedSheet(monthKey, newList);
  };

  const updateStatutInline = (id: string, key: "statutCommande" | "statutTracktagos", val: string) => {
    const newList = commandes.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, [key]: val };
      if (key === "statutTracktagos") {
        updated.attente8HStartedAt = val === "Attente 8H" ? new Date().toISOString() : "";
      }
      return updated;
    });
    setCommandes(newList);
    saveCommandes(newList);
    scheduleDriveSync(newList, linkedSheets, loadTaux());
    const monthKey = getMonthKey(commandes.find(c => c.id === id)?.createdAt ?? new Date().toISOString());
    syncLinkedSheet(monthKey, newList);
  };

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
    if (!currentMonthSheetId) {
      toast.error(`Aucune feuille liée pour ${monthLabel(currentMonthKey)}. Liez un Google Sheet avant d'ajouter une commande.`, { duration: 6000 });
      return;
    }
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
    let monthKey: string;
    if (editId) {
      const original = commandes.find(c => c.id === editId);
      monthKey = getMonthKey(original?.createdAt ?? new Date().toISOString());
      newList = commandes.map(c => c.id === editId ? { ...c, ...data } : c);
      toast.success("Commande modifiée");
    } else {
      const createdAt = new Date().toISOString();
      monthKey = getMonthKey(createdAt);
      newList = [{ id: crypto.randomUUID(), createdAt, ...data }, ...commandes];
      toast.success("Commande ajoutée");
    }
    setCommandes(newList);
    saveCommandes(newList);
    scheduleDriveSync(newList, linkedSheets, data.tauxImposition || loadTaux());
    setModalOpen(false);
    syncLinkedSheet(monthKey, newList);
  };

  const confirmDelete = (id: string) => setDeleteId(id);

  const doDelete = () => {
    if (!deleteId) return;
    const toDelete = commandes.find(c => c.id === deleteId);
    const monthKey = toDelete ? getMonthKey(toDelete.createdAt) : "";
    const newList = commandes.filter(c => c.id !== deleteId);
    setCommandes(newList);
    saveCommandes(newList);
    scheduleDriveSync(newList, linkedSheets, loadTaux());
    setDeleteId(null);
    toast.success("Commande supprimée");
    if (monthKey) syncLinkedSheet(monthKey, newList);
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
      // Auto-crée Stockage s'il n'existe pas
      let stockageId = await driveStore.resolveFolderPath(["Stockage"]);
      if (!stockageId) {
        stockageId = await driveStore.createFolder("Stockage", "root");
        if (!stockageId) { toast.error("Impossible de créer le dossier Stockage dans Drive"); return; }
      }
      const recapId = await driveStore.findOrCreateFolder("Document Recap Etsy", stockageId);
      if (!recapId) { toast.error("Impossible de créer le dossier Document Recap Etsy"); return; }

      const ext = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
      const finalName = (commande.noEtsy || file.name.replace(/\.[^/.]+$/, "")) + ext;
      const result = await driveStore.uploadFileToDrive(file, finalName, recapId);
      if (typeof result !== "string") {
        toast.error(`Échec de l'upload : ${result.error}`, { duration: 8000 });
        return;
      }

      const newList = commandes.map(c =>
        c.id === targetId ? { ...c, docEtsyFileId: result, docEtsyFileName: finalName } : c
      );
      setCommandes(newList);
      saveCommandes(newList);
      scheduleDriveSync(newList, linkedSheets, loadTaux());
      toast.success(`Document uploadé dans Drive / Stockage / Document Recap Etsy`);
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
        await driveStore.writeSheetRows(sheetId, monthCommandes.map(commandeToRow));
      }

      const mKey = `${genYear}-${String(parseInt(genMonth)).padStart(2, "0")}`;
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
      if (!loadLinkedSheets()[mKey]) {
        toast.info(`Lier ${monthLabel(mKey)} à cette feuille pour la synchro auto ?`, {
          duration: 12000,
          action: {
            label: "Lier",
            onClick: () => {
              const updated = { ...loadLinkedSheets(), [mKey]: sheetId };
              saveLinkedSheets(updated);
              setLinkedSheets(updated);
              scheduleDriveSync(commandes, updated, loadTaux());
              toast.success(`${monthLabel(mKey)} lié ! Synchro automatique activée.`);
            },
          },
        });
      }
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
        <h1 className="font-display text-2xl font-bold">Suivi Commande</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setStatsOpen(true)}>
            <BarChart2 className="h-3.5 w-3.5" />
            Statistiques
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => exportCSV(displayed)}
            title={`Exporter ${displayed.length} commande${displayed.length !== 1 ? "s" : ""} filtrées en CSV`}
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 text-xs ${Object.keys(linkedSheets).length > 0 ? "text-emerald-600 border-emerald-400 dark:text-emerald-400" : ""}`}
            onClick={() => setLinkOpen(true)}
            title="Gérer les feuilles Google Sheets liées par mois"
          >
            <Link2 className="h-3.5 w-3.5" />
            {Object.keys(linkedSheets).length > 0 ? `${Object.keys(linkedSheets).length} feuille${Object.keys(linkedSheets).length > 1 ? "s liées" : " liée"}` : "Lier des feuilles"}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setGenOpen(true)}>
            <FileText className="h-3.5 w-3.5" />
            Générer feuille mensuelle
          </Button>
          <div className="flex items-center gap-2">
            {currentMonthSheetId ? (
              <a
                href={`https://docs.google.com/spreadsheets/d/${currentMonthSheetId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 rounded px-2 py-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                title="Feuille liée pour ce mois — cliquer pour ouvrir"
              >
                <Link2 className="h-3 w-3" />
                {monthLabel(currentMonthKey)}
              </a>
            ) : (
              <span
                className="flex items-center gap-1.5 text-[11px] text-destructive border border-destructive/40 rounded px-2 py-1 cursor-pointer hover:bg-destructive/5 transition-colors"
                onClick={() => setLinkOpen(true)}
                title="Aucune feuille liée pour ce mois — cliquer pour en lier une"
              >
                <AlertTriangle className="h-3 w-3" />
                Aucune feuille liée
              </span>
            )}
            {/* Indicateur sync Drive */}
            {driveStore.isAuthorized() && (
              <span
                className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                  syncStatus === "syncing" ? "text-primary/60" :
                  syncStatus === "ok"      ? "text-emerald-500" :
                  syncStatus === "error"   ? "text-destructive" :
                  "text-muted-foreground/30"
                }`}
                title={
                  syncStatus === "syncing" ? "Synchronisation Drive en cours…" :
                  syncStatus === "ok"      ? "Données sauvegardées sur Google Drive" :
                  syncStatus === "error"   ? "Erreur de sync Drive — données sauvegardées en local" :
                  "Non synchronisé"
                }
              >
                {syncStatus === "syncing"
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : syncStatus === "error"
                    ? <CloudOff className="h-3 w-3" />
                    : <Cloud className="h-3 w-3" />
                }
              </span>
            )}
            <Button size="sm" className="gap-1.5 text-xs" onClick={openAdd} disabled={!currentMonthSheetId}>
              <Plus className="h-3.5 w-3.5" />
              Nouvelle commande
            </Button>
          </div>
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          ref={searchInputRef}
          placeholder="Rechercher N°ETSY, client, ref... (f)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs w-52"
        />
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Statuts Commandes</SelectItem>
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
        <Select value={filterTracktagos} onValueChange={setFilterTracktagos}>
          <SelectTrigger className="h-8 text-xs w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Statuts Tracktacos</SelectItem>
            {STATUTS_TRACKTAGOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className={`h-8 text-xs w-36 ${filterMonth !== "all" ? "border-primary text-primary" : ""}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les mois</SelectItem>
            {monthsUsed.map(m => (
              <SelectItem key={m} value={m}>
                {monthLabel(m)}
                {linkedSheets[m] && <span className="ml-1 text-emerald-500 text-[10px]">●</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={() => setSortBy(s => s === "dateLimite" ? "none" : "dateLimite")}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
            sortBy === "dateLimite"
              ? "border-primary text-primary bg-primary/10"
              : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
          }`}
          title="Trier par date limite (les plus urgentes en premier)"
        >
          <ArrowUpDown className="h-3 w-3" /> Date limite
        </button>
        {(filterMonth !== "all" || filterStatut !== "all" || filterBoutique !== "all" || filterTracktagos !== "all" || search) && (
          <button
            onClick={() => { setFilterMonth("all"); setFilterStatut("all"); setFilterBoutique("all"); setFilterTracktagos("all"); setSearch(""); }}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <X className="h-3 w-3" /> Effacer filtres
          </button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{displayed.length} commande{displayed.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="tool-card p-0 overflow-hidden flex-1 min-h-0">
        <div className="overflow-auto h-full">
          <table className="w-full text-xs border-collapse" style={{ minWidth: 1700 }}>
            <thead className="sticky top-0 z-10 bg-secondary/80 backdrop-blur">
              <tr>
                {[
                  "", "Statut commande", "Statut Tracktacos", "Date limite",
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
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={18} className="text-center py-12 text-muted-foreground text-xs">
                    Aucune commande. Cliquez sur « Nouvelle commande » pour commencer.
                  </td>
                </tr>
              )}
              {displayed.map(c => {
                const retard = isEnRetard(c);
                const aujourdhui = !retard && isAujourdhuiLimite(c);
                const proche = !retard && !aujourdhui && isProcheDateLimite(c);
                const trackEnCours = c.statutTracktagos === "Attente 8H" || c.statutTracktagos === "Numéro de Suivi à changer";
                const rowBg = !trackEnCours && retard
                  ? ROW_BG["Litige"] ?? ""
                  : !trackEnCours && aujourdhui
                    ? "bg-orange-50/60 dark:bg-orange-950/25"
                  : !trackEnCours && proche
                    ? "bg-violet-50/60 dark:bg-violet-950/25"
                    : ROW_BG[c.statutCommande] ?? "";
                const countdown = c.statutTracktagos === "Attente 8H" && c.attente8HStartedAt
                  ? formatCountdown(c.attente8HStartedAt, now)
                  : null;
                return (
                  <tr key={c.id} className={`border-b border-border/50 transition-colors ${rowBg}`}>
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
                      <InlineStatusSelect value={c.statutCommande} options={STATUTS_COMMANDE} map={CMD_BADGE} onChange={v => updateStatutInline(c.id, "statutCommande", v)} />
                    </td>
                    {/* Statut Tracktacos */}
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <InlineStatusSelect value={c.statutTracktagos} options={STATUTS_TRACKTAGOS} map={TRACK_BADGE} onChange={v => updateStatutInline(c.id, "statutTracktagos", v)} />
                      {countdown && (
                        <div className={`mt-0.5 font-mono text-[10px] font-semibold ${countdown.expired ? "text-orange-500" : "text-yellow-600 dark:text-yellow-400"}`}>
                          <Clock className="inline h-2.5 w-2.5 mr-0.5" />
                          {countdown.label}
                        </div>
                      )}
                    </td>
                    {/* Date limite */}
                    {(() => {
                      const trackEnCours = c.statutTracktagos === "Attente 8H" || c.statutTracktagos === "Numéro de Suivi à changer";
                      const showAlerte = !trackEnCours;
                      return (
                        <td className={`px-2 py-1.5 whitespace-nowrap font-mono text-[10px] ${
                          showAlerte && retard ? "text-red-500 font-semibold"
                          : showAlerte && aujourdhui ? "text-orange-500 font-semibold"
                          : showAlerte && proche ? "text-violet-500 font-semibold"
                          : ""
                        }`}>
                          {c.dateLimiteEnvoi || "—"}
                          {showAlerte && retard && <span className="ml-1 text-[9px] text-red-500">⚠ retard</span>}
                          {showAlerte && aujourdhui && <span className="ml-1 text-[9px] text-orange-500">⚠ aujourd'hui</span>}
                          {showAlerte && proche && <span className="ml-1 text-[9px] text-violet-500">⚠ demain</span>}
                        </td>
                      );
                    })()}
                    {/* N° ETSY */}
                    <td className="px-2 py-1.5 whitespace-nowrap"><CopyCell value={c.noEtsy} /></td>
                    {/* N° ALIEXPRESS */}
                    <td className="px-2 py-1.5 whitespace-nowrap" style={{ minWidth: 80 }}>
                      <InlineTextInput value={c.noAliexpress} onChange={v => updateFieldInline(c.id, "noAliexpress", v)} />
                    </td>
                    {/* N° TRACKTAGOS */}
                    <td className="px-2 py-1.5 whitespace-nowrap" style={{ minWidth: 80 }}>
                      <InlineTextInput value={c.noTracktagos} onChange={v => updateFieldInline(c.id, "noTracktagos", v)} />
                    </td>
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

      {/* Stats */}
      <StatsDialog open={statsOpen} onClose={() => setStatsOpen(false)} commandes={commandes} />

      {/* Add/Edit modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Modifier la commande" : "Nouvelle commande"}</DialogTitle>
          </DialogHeader>

          {!editId && currentMonthSheetId && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-400">
              <Link2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Sera enregistrée dans <strong>{monthLabel(currentMonthKey)}</strong></span>
              <a
                href={`https://docs.google.com/spreadsheets/d/${currentMonthSheetId}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto hover:underline flex items-center gap-1"
              >
                Ouvrir <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

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
                <div className="space-y-1 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Ref Produit</Label>
                    {loadingProduits
                      ? <span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Loader2 className="h-2.5 w-2.5 animate-spin" />Chargement…</span>
                      : Object.keys(produitsBoutique).length === 0
                        ? <span className="text-[10px] text-muted-foreground">Sheet "Liste Boutique" introuvable</span>
                        : null
                    }
                  </div>
                  {(() => {
                    // Tous les produits de tous les onglets, groupés par boutique
                    const allEntries = Object.entries(produitsBoutique);
                    const allProduits = allEntries.flatMap(([boutique, prods]) =>
                      prods.map(p => ({ ...p, boutique }))
                    );
                    // Si boutique sélectionnée et qu'elle a des produits → filtrer
                    const filtered = form.boutique && produitsBoutique[form.boutique]?.length
                      ? allProduits.filter(p => p.boutique === form.boutique)
                      : allProduits;

                    if (filtered.length === 0) {
                      return (
                        <Input
                          value={form.refProduit}
                          onChange={e => patch("refProduit", e.target.value)}
                          className="h-8 text-xs"
                          placeholder="Saisie libre"
                        />
                      );
                    }

                    // Trouver la valeur sélectionnée (num uniquement pour la clé Select)
                    const selectedKey = filtered.find(p => `${p.num} - ${p.nom}` === form.refProduit)?.num
                      ?? filtered.find(p => p.num === form.refProduit)?.num
                      ?? NONE;

                    return (
                      <Select
                        value={selectedKey}
                        onValueChange={v => {
                          if (v === NONE) { patch("refProduit", ""); return; }
                          const p = filtered.find(p => p.num === v);
                          patch("refProduit", p ? `${p.num} - ${p.nom}` : v);
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Choisir un produit…" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          <SelectItem value={NONE}>—</SelectItem>
                          {allEntries.length > 1 && !form.boutique
                            ? allEntries.map(([boutique, prods]) => (
                                prods.length === 0 ? null :
                                <div key={boutique}>
                                  <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground border-t border-border mt-1">
                                    {boutique}
                                  </div>
                                  {prods.map(p => (
                                    <SelectItem key={`${boutique}-${p.num}`} value={p.num}>
                                      <span className="font-mono text-[10px] text-muted-foreground mr-1.5">{p.num}</span>
                                      {p.nom}
                                    </SelectItem>
                                  ))}
                                </div>
                              ))
                            : filtered.map(p => (
                                <SelectItem key={`${p.boutique}-${p.num}`} value={p.num}>
                                  <span className="font-mono text-[10px] text-muted-foreground mr-1.5">{p.num}</span>
                                  {p.nom}
                                </SelectItem>
                              ))
                          }
                        </SelectContent>
                      </Select>
                    );
                  })()}
                </div>
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

      {/* Link Google Sheets dialog — one sheet per month */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feuilles Google Sheets par mois</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-4">
            Associez un Google Sheet à chaque mois. Chaque ajout, modification ou suppression de commande mettra à jour automatiquement la feuille correspondante.
          </p>
          {monthsUsed.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Aucune commande pour le moment.</p>
          )}
          <div className="space-y-3">
            {monthsUsed.map(mk => {
              const currentId = linkedSheets[mk] ?? "";
              const inputVal = linkInputs[mk] ?? currentId;
              return (
                <div key={mk} className="p-3 rounded-lg border border-border bg-secondary/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold">{monthLabel(mk)}</span>
                    {currentId && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <Link2 className="h-3 w-3" /> Liée
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={inputVal}
                      onChange={e => setLinkInputs(prev => ({ ...prev, [mk]: e.target.value }))}
                      placeholder="URL ou ID Google Sheet…"
                      className="h-7 text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 shrink-0"
                      onClick={() => {
                        const id = extractSheetId(inputVal);
                        if (!id) { toast.error("URL ou ID invalide"); return; }
                        const updated = { ...linkedSheets, [mk]: id };
                        saveLinkedSheets(updated);
                        setLinkedSheets(updated);
                        scheduleDriveSync(commandes, updated, loadTaux());
                        toast.success(`${monthLabel(mk)} lié !`);
                      }}
                    >
                      Lier
                    </Button>
                    {currentId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs px-2 text-destructive shrink-0"
                        onClick={() => {
                          const updated = { ...linkedSheets };
                          delete updated[mk];
                          saveLinkedSheets(updated);
                          setLinkedSheets(updated);
                          scheduleDriveSync(commandes, updated, loadTaux());
                          setLinkInputs(prev => ({ ...prev, [mk]: "" }));
                          toast.success(`${monthLabel(mk)} dissocié`);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {currentId && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${currentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      Ouvrir dans Google Sheets
                    </a>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Fermer</Button>
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
