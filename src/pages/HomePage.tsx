import { FileText, ImageDown, Camera, ExternalLink, Table2, Store, Package, FolderPlus, Tags, BarChart3, UserSearch, FileImage, PersonStanding, Layers, AlertTriangle, Clock, ChevronDown, ArrowRight, RefreshCw, Search, Wifi, WifiOff, Star, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

const N8N_BASE = "https://n8n.srv1196541.hstgr.cloud";

type Tool = {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  url: string;
  color: string;
  primary?: boolean;
  shortcut?: string;
};

const allTools: Tool[] = [
  { title: "Gen Fiches Produits", desc: "Créer une nouvelle fiche produit Etsy", icon: FileText, url: "/creation-fiche", color: "text-primary", primary: true, shortcut: "gf" },
  { title: "Téléchargement Images", desc: "Télécharger les images scrapées", icon: ImageDown, url: "/download-images", color: "text-success", primary: true, shortcut: "gd" },
  { title: "Gen Images", desc: "Générer des images produit avec IA", icon: Camera, url: "/generation-photos", color: "text-warning", primary: true, shortcut: "gi" },
  { title: "Modèle", desc: "Générer des photos de modèle avec IA", icon: PersonStanding, url: "/generation-modele", color: "text-orange-400", shortcut: "gm" },
  { title: "Analyse Image", desc: "Extraire les tags depuis une image", icon: Tags, url: "/analyse-image", color: "text-blue-400", shortcut: "ga" },
  { title: "Analyse Tags", desc: "Analyser et optimiser vos tags", icon: BarChart3, url: "/analyse-tags", color: "text-purple-400", shortcut: "gt" },
  { title: "Tags Concurrent", desc: "Espionner les tags des concurrents", icon: UserSearch, url: "/tags-concurrent", color: "text-pink-400", shortcut: "gc" },
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

function loadCommandesDateButoire(): CommandeAlert[] {
  try {
    const today = new Date().toDateString();
    const all = JSON.parse(localStorage.getItem("suivi-commandes-v1") ?? "[]");
    return all.filter((c: any) => {
      if (!c.dateLimiteEnvoi || c.statutCommande === "Livré") return false;
      return new Date(c.dateLimiteEnvoi) <= new Date(today);
    });
  } catch { return []; }
}

function loadCommandesBientot(jours = 3): CommandeAlert[] {
  try {
    const today = new Date(new Date().toDateString());
    const limite = new Date(today);
    limite.setDate(today.getDate() + jours);
    const all = JSON.parse(localStorage.getItem("suivi-commandes-v1") ?? "[]");
    return all.filter((c: any) => {
      if (!c.dateLimiteEnvoi || c.statutCommande === "Livré") return false;
      const d = new Date(c.dateLimiteEnvoi);
      return d > today && d <= limite;
    }).sort((a: any, b: any) => a.dateLimiteEnvoi.localeCompare(b.dateLimiteEnvoi));
  } catch { return []; }
}

// ── Search modal ───────────────────────────────────────────────────────────────

type SearchItem = { label: string; desc: string; url: string; icon: React.ComponentType<{ className?: string }>; external?: boolean };

function buildSearchItems(): SearchItem[] {
  const items: SearchItem[] = allTools.map(t => ({ label: t.title, desc: t.desc, url: t.url, icon: t.icon }));
  sheets.forEach(s => items.push({ label: s.title, desc: "Google Sheets", url: s.url, icon: s.icon, external: true }));
  return items;
}

function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const items = buildSearchItems();
  const filtered = query.trim()
    ? items.filter(i => i.label.toLowerCase().includes(query.toLowerCase()) || i.desc.toLowerCase().includes(query.toLowerCase()))
    : items;

  useEffect(() => { setActiveIndex(0); }, [query]);

  useEffect(() => {
    if (open) { setQuery(""); setActiveIndex(0); setTimeout(() => inputRef.current?.focus(), 10); }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && filtered[activeIndex]) {
        const item = filtered[activeIndex];
        if (item.external) { window.open(item.url, "_blank"); }
        else { navigate(item.url); }
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, activeIndex, navigate, onClose]);

  if (!open) return null;

  const handleSelect = (item: SearchItem) => {
    if (item.external) { window.open(item.url, "_blank"); }
    else { navigate(item.url); }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-card rounded-xl shadow-2xl border border-border overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un outil..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun résultat</p>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.url + item.label}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === activeIndex ? "bg-primary/10 text-primary" : "hover:bg-secondary/60"}`}
              >
                <item.icon className={`h-4 w-4 shrink-0 ${i === activeIndex ? "text-primary" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                </div>
                {item.external && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />}
              </button>
            ))
          )}
        </div>
        <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[10px] text-muted-foreground">
          <span><kbd className="font-mono bg-muted px-1 rounded">↑↓</kbd> Naviguer</span>
          <span><kbd className="font-mono bg-muted px-1 rounded">↵</kbd> Ouvrir</span>
          <span><kbd className="font-mono bg-muted px-1 rounded">Esc</kbd> Fermer</span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate();
  const [newBoutiqueName, setNewBoutiqueName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [commandesAlert, setCommandesAlert] = useState<CommandeAlert[]>([]);
  const [commandesButoire, setCommandesButoire] = useState<CommandeAlert[]>([]);
  const [commandesBientot, setCommandesBientot] = useState<CommandeAlert[]>([]);
  const [bientotOpen, setBientotOpen] = useState(false);

  // Search
  const [searchOpen, setSearchOpen] = useState(false);

  // n8n status
  const [n8nStatus, setN8nStatus] = useState<"unknown" | "ok" | "down">("unknown");

  // Chord shortcut indicator
  const [chordActive, setChordActive] = useState(false);

  // ── Commandes alerts ────────────────────────────────────────────────────────
  useEffect(() => {
    const refresh = () => {
      setCommandesAlert(loadCommandesAChanger());
      setCommandesButoire(loadCommandesDateButoire());
      setCommandesBientot(loadCommandesBientot());
    };
    refresh();
    const interval = setInterval(refresh, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  // ── n8n ping ────────────────────────────────────────────────────────────────
  const pingN8n = useCallback(async () => {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      await fetch(N8N_BASE, { method: "HEAD", mode: "no-cors", signal: controller.signal });
      clearTimeout(tid);
      setN8nStatus("ok");
    } catch {
      setN8nStatus("down");
    }
  }, []);

  useEffect(() => {
    pingN8n();
    const interval = setInterval(pingN8n, 60_000);
    return () => clearInterval(interval);
  }, [pingN8n]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const chordMap: Record<string, string> = {
      f: "/creation-fiche",
      d: "/download-images",
      i: "/generation-photos",
      m: "/generation-modele",
      a: "/analyse-image",
      t: "/analyse-tags",
      c: "/tags-concurrent",
    };

    let waitingForChord = false;
    let chordTimer: ReturnType<typeof setTimeout> | null = null;

    const onKey = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K → search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (searchOpen) return;

      if (e.key === "g" && !e.metaKey && !e.ctrlKey && !waitingForChord) {
        waitingForChord = true;
        setChordActive(true);
        chordTimer = setTimeout(() => { waitingForChord = false; setChordActive(false); }, 1500);
        return;
      }

      if (waitingForChord) {
        if (chordTimer) clearTimeout(chordTimer);
        waitingForChord = false;
        setChordActive(false);
        if (chordMap[e.key]) {
          e.preventDefault();
          navigate(chordMap[e.key]);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); if (chordTimer) clearTimeout(chordTimer); };
  }, [navigate, searchOpen]);

  const handleCreateBoutique = () => {
    if (!newBoutiqueName.trim()) return;
    alert(`Création du dossier "${newBoutiqueName}" dans Google Drive...`);
    setNewBoutiqueName("");
    setDialogOpen(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold tracking-tight">Dashboard Etsy</h1>
        <div className="flex items-center gap-3">
          {/* n8n status */}
          <button
            onClick={pingN8n}
            title={n8nStatus === "ok" ? "n8n joignable" : n8nStatus === "down" ? "n8n inaccessible — cliquer pour réessayer" : "Vérification n8n..."}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {n8nStatus === "ok" && <Wifi className="h-3.5 w-3.5 text-success" />}
            {n8nStatus === "down" && <WifiOff className="h-3.5 w-3.5 text-destructive" />}
            {n8nStatus === "unknown" && <Wifi className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />}
            <span className={n8nStatus === "ok" ? "text-success" : n8nStatus === "down" ? "text-destructive" : ""}>
              n8n
            </span>
          </button>

          {/* Search button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Rechercher...</span>
            <kbd className="hidden sm:inline-flex items-center font-mono text-[10px] bg-muted px-1 rounded">⌘K</kbd>
          </button>
        </div>
      </div>

      {/* Search modal */}
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Chord indicator */}
      {chordActive && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-popover border border-border rounded-full px-4 py-2 shadow-lg text-sm font-mono animate-in fade-in slide-in-from-bottom-2">
          <kbd className="bg-primary text-primary-foreground rounded px-1.5 py-0.5 text-xs font-bold">G</kbd>
          <span className="text-muted-foreground">+ F·D·I·M·A·T·C</span>
        </div>
      )}

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
                <button onClick={() => setCommandesAlert(loadCommandesAChanger())} className="text-primary/60 hover:text-primary transition-colors" title="Rafraîchir">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => navigate("/suivi-commandes")} className="flex items-center gap-1 text-xs text-primary/80 hover:text-primary font-medium transition-colors">
                  Voir tout <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-primary/10">
              {commandesAlert.map(c => (
                <button key={c.id} onClick={() => navigate("/suivi-commandes")} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary/10 transition-colors text-left">
                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5">
                    <div><p className="text-[9px] text-muted-foreground uppercase tracking-wide">N° ETSY</p><p className="text-xs font-mono font-medium truncate">{c.noEtsy || "—"}</p></div>
                    <div><p className="text-[9px] text-muted-foreground uppercase tracking-wide">Produit</p><p className="text-xs font-medium truncate">{c.refProduit || "—"}</p></div>
                    <div><p className="text-[9px] text-muted-foreground uppercase tracking-wide">Boutique</p><p className="text-xs truncate">{c.boutique || "—"}</p></div>
                    <div><p className="text-[9px] text-muted-foreground uppercase tracking-wide">N° Tracktagos actuel</p><p className="text-xs font-mono truncate text-primary">{c.noTracktagos || "—"}</p></div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Alerte — Date butoire aujourd'hui ou dépassée */}
      {commandesButoire.length > 0 && (
        <section>
          <div className="rounded-xl border border-destructive/40 bg-destructive/8 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-destructive/20">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-destructive" />
                <span className="font-semibold text-sm text-destructive">
                  {commandesButoire.length} commande{commandesButoire.length > 1 ? "s" : ""} à envoyer aujourd'hui ou en retard
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCommandesButoire(loadCommandesDateButoire())} className="text-destructive/60 hover:text-destructive transition-colors" title="Rafraîchir">
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => navigate("/suivi-commandes")} className="flex items-center gap-1 text-xs text-destructive/80 hover:text-destructive font-medium transition-colors">
                  Voir tout <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
            <div className="divide-y divide-destructive/10">
              {commandesButoire.map(c => {
                const today = new Date().toDateString();
                const isToday = c.dateLimiteEnvoi ? new Date(c.dateLimiteEnvoi).toDateString() === today : false;
                return (
                  <button key={c.id} onClick={() => navigate("/suivi-commandes")} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-destructive/10 transition-colors text-left">
                    <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5">
                      <div><p className="text-[9px] text-muted-foreground uppercase tracking-wide">N° ETSY</p><p className="text-xs font-mono font-medium truncate">{c.noEtsy || "—"}</p></div>
                      <div><p className="text-[9px] text-muted-foreground uppercase tracking-wide">Produit</p><p className="text-xs font-medium truncate">{c.refProduit || "—"}</p></div>
                      <div><p className="text-[9px] text-muted-foreground uppercase tracking-wide">Boutique</p><p className="text-xs truncate">{c.boutique || "—"}</p></div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Date limite</p>
                        <p className={`text-xs font-mono font-semibold ${isToday ? "text-orange-500" : "text-destructive"}`}>
                          {c.dateLimiteEnvoi || "—"}
                          {isToday && <span className="ml-1 text-[9px] font-normal">Aujourd'hui</span>}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-destructive/60 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Menu déroulant — Commandes bientôt en date limite */}
      {commandesBientot.length > 0 && (
        <section>
          <button onClick={() => setBientotOpen(o => !o)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${bientotOpen ? "rotate-180" : ""}`} />
            <span>{commandesBientot.length} commande{commandesBientot.length > 1 ? "s" : ""} à envoyer dans les 3 prochains jours</span>
          </button>
          {bientotOpen && (
            <div className="mt-2 rounded-xl border border-orange-500/30 bg-orange-500/5 overflow-hidden">
              <div className="divide-y divide-orange-500/10">
                {commandesBientot.map(c => {
                  const today = new Date(new Date().toDateString());
                  const d = new Date(c.dateLimiteEnvoi);
                  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
                  const label = diffDays === 1 ? "Demain" : `J-${diffDays}`;
                  return (
                    <button key={c.id} onClick={() => navigate("/suivi-commandes")} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-orange-500/10 transition-colors text-left">
                      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5">
                        <div><p className="text-[9px] text-muted-foreground uppercase tracking-wide">N° ETSY</p><p className="text-xs font-mono font-medium truncate">{c.noEtsy || "—"}</p></div>
                        <div><p className="text-[9px] text-muted-foreground uppercase tracking-wide">Produit</p><p className="text-xs font-medium truncate">{c.refProduit || "—"}</p></div>
                        <div><p className="text-[9px] text-muted-foreground uppercase tracking-wide">Boutique</p><p className="text-xs truncate">{c.boutique || "—"}</p></div>
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Date limite</p>
                          <p className="text-xs font-mono font-semibold text-orange-500">
                            {c.dateLimiteEnvoi}<span className="ml-1 text-[9px] font-normal text-orange-400">{label}</span>
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-orange-500/60 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Outils — grille unifiée */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Outils</h2>
          <span className="text-xs text-muted-foreground">
            <Star className="h-3 w-3 inline mr-0.5 text-primary/60" /> = principal
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {allTools.map((tool) => (
            <button
              key={tool.url}
              onClick={() => navigate(tool.url)}
              className="tool-card text-left group hover:glow-primary relative"
            >
              {tool.primary && (
                <Star className="absolute top-3 right-3 h-3 w-3 text-primary/50 fill-primary/20" />
              )}
              <tool.icon className={`h-8 w-8 ${tool.color} mb-3`} />
              <h3 className="font-display font-semibold text-foreground">{tool.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{tool.desc}</p>
              {tool.shortcut && (
                <div className="mt-2">
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-muted-foreground/50 bg-muted/40 rounded px-1.5 py-0.5">
                    {tool.shortcut[0].toUpperCase()} + {tool.shortcut[1].toUpperCase()}
                  </span>
                </div>
              )}
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
              <p className="text-xs text-muted-foreground mt-2">Un dossier sera créé à la racine de votre Google Drive</p>
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
