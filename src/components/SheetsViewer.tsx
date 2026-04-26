import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Loader2, LogIn, Save, AlertCircle, ExternalLink, Copy, ChevronDown, ChevronUp, RefreshCw, Palette, Star, PackagePlus } from "lucide-react";
import { driveStore } from "@/lib/driveStore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getFavorites, addFavorite, removeFavorite } from "@/lib/colorFavorites";

// Palette de couleurs rapides (fond ou texte avec Shift)
const QUICK_COLORS = [
  { value: "#ffffff", label: "Blanc" },
  { value: "#f3f3f3", label: "Gris clair" },
  { value: "#fce8e8", label: "Rouge pâle" },
  { value: "#fff3cd", label: "Jaune pâle" },
  { value: "#d4edda", label: "Vert pâle" },
  { value: "#d1ecf1", label: "Bleu pâle" },
  { value: "#e8d5f5", label: "Violet pâle" },
  { value: "#ffd6cc", label: "Orange pâle" },
  { value: "#f5a623", label: "Orange" },
  { value: "#f44336", label: "Rouge" },
  { value: "#4caf50", label: "Vert" },
  { value: "#2196f3", label: "Bleu" },
  { value: "#9c27b0", label: "Violet" },
  { value: "#212121", label: "Noir" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractIds(url: string) {
  const idMatch = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  return { spreadsheetId: idMatch?.[1] ?? null, gid: gidMatch?.[1] ?? "0" };
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let pos = 0;

  while (pos < src.length) {
    const row: string[] = [];
    let rowEmpty = true;

    while (pos < src.length && src[pos] !== "\n") {
      let cell = "";
      if (src[pos] === '"') {
        pos++;
        while (pos < src.length) {
          if (src[pos] === '"') {
            if (src[pos + 1] === '"') { cell += '"'; pos += 2; }
            else { pos++; break; }
          } else {
            cell += src[pos++];
          }
        }
        if (src[pos] === ",") pos++;
      } else {
        while (pos < src.length && src[pos] !== "," && src[pos] !== "\n") {
          cell += src[pos++];
        }
        if (src[pos] === ",") pos++;
      }
      if (cell) rowEmpty = false;
      row.push(cell);
    }
    if (src[pos] === "\n") pos++;
    if (!rowEmpty) rows.push(row);
  }
  return rows;
}

function isUrl(val: string) {
  return /^https?:\/\//.test(val.trim());
}

function shortUrl(val: string): string {
  try {
    const u = new URL(val.trim());
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.length > 1 ? u.pathname.slice(0, 18) + (u.pathname.length > 18 ? "…" : "") : "";
    return host + path;
  } catch {
    return val.slice(0, 25) + (val.length > 25 ? "…" : "");
  }
}

// ── Cell metadata (colors + dropdowns) ───────────────────────────────────────

type CellMeta = { bgColor?: string; textColor?: string; options?: string[] };

function rgbStringToHex(rgb: string): string {
  const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return "#000000";
  return "#" + [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, "0")).join("");
}

async function fetchSheetFormatting(spreadsheetId: string, gid: string, token: string): Promise<CellMeta[][]> {
  try {
    const fields = "sheets(properties/sheetId,data/rowData/values(effectiveFormat/backgroundColor,dataValidation/condition))";
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true&fields=${encodeURIComponent(fields)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const sheet = (data.sheets ?? []).find((s: any) => String(s.properties?.sheetId) === gid);
    if (!sheet) return [];
    return (sheet.data?.[0]?.rowData ?? []).map((row: any) =>
      (row.values ?? []).map((cell: any): CellMeta => {
        const meta: CellMeta = {};
        const bg = cell.effectiveFormat?.backgroundColor;
        if (bg) {
          const r = Math.round((bg.red ?? 1) * 255);
          const g = Math.round((bg.green ?? 1) * 255);
          const b = Math.round((bg.blue ?? 1) * 255);
          if (r < 250 || g < 250 || b < 250) meta.bgColor = `rgb(${r},${g},${b})`;
        }
        const fg = cell.effectiveFormat?.textFormat?.foregroundColor;
        if (fg) {
          const r = Math.round((fg.red ?? 0) * 255);
          const g = Math.round((fg.green ?? 0) * 255);
          const b = Math.round((fg.blue ?? 0) * 255);
          if (r > 10 || g > 10 || b > 10) meta.textColor = `rgb(${r},${g},${b})`;
        }
        const cond = cell.dataValidation?.condition;
        if (cond?.type === "ONE_OF_LIST") {
          meta.options = (cond.values ?? []).map((v: any) => v.userEnteredValue ?? "").filter(Boolean);
        }
        return meta;
      })
    );
  } catch { return []; }
}

async function fetchAllSheets(spreadsheetId: string, token: string): Promise<{ sheetId: number; title: string }[]> {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.sheets ?? []).map((s: any) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
    }));
  } catch { return []; }
}

// ── Cell components ───────────────────────────────────────────────────────────

function UrlCell({ val }: { val: string }) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <a
        href={val}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:underline flex items-center gap-1 min-w-0 flex-1"
        title={val}
        onClick={e => e.stopPropagation()}
      >
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
        <span className="truncate text-xs">{shortUrl(val)}</span>
      </a>
      <button
        onClick={() => { navigator.clipboard.writeText(val); toast.success("Copié !"); }}
        className="text-muted-foreground hover:text-foreground p-0.5 rounded flex-shrink-0"
        title="Copier"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function TextCell({
  val,
  canEdit,
  onBlur,
  saving,
  expanded,
}: {
  val: string;
  canEdit: boolean;
  onBlur: (e: React.FocusEvent<HTMLDivElement>) => void;
  saving: boolean;
  expanded: boolean;
}) {
  return (
    <div className="flex items-start gap-1 min-w-0 w-full h-full">
      <div
        contentEditable={canEdit}
        suppressContentEditableWarning
        onBlur={onBlur}
        className={`outline-none flex-1 text-xs min-w-0 ${expanded ? "whitespace-pre-wrap break-words" : "truncate"} ${canEdit ? "cursor-text" : ""}`}
        title={!expanded ? (val || undefined) : undefined}
      >
        {val}
      </div>
      {saving && <Loader2 className="h-3 w-3 animate-spin text-primary flex-shrink-0 mt-0.5" />}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

const MIN_COL = 60;
const DEFAULT_COL = 100;
const EXTRA_ROWS = 20;
const CELL_HEIGHT = 28;

type ImportRowData = { etsy_lien: string; lien_ali: string; categorie: string; nom_du_produit: string; boutique_nom: string; fiche_numero: string };

export function SheetsViewer({ url, title, onImportRow }: { url: string; title?: string; onImportRow?: (data: ImportRowData) => void }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<{ sheetId: number; title: string }[]>([]);
  const [activeGid, setActiveGid] = useState(() => extractIds(url).gid);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [colWidths, setColWidths] = useState<number[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [missingScope, setMissingScope] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [formatting, setFormatting] = useState<CellMeta[][]>([]);
  const [selectedCell, setSelectedCell] = useState<{ ri: number; ci: number } | null>(null);
  const [fmtBg, setFmtBg] = useState("#ffffff");
  const [fmtText, setFmtText] = useState("#000000");
  const [fmtApplying, setFmtApplying] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const resizing = useRef<{ col: number; startX: number; startW: number } | null>(null);
  const applyBgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyTextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestBg = useRef(fmtBg);
  const latestText = useRef(fmtText);

  const { spreadsheetId: urlSid, gid: urlGid } = useMemo(() => extractIds(url), [url]);

  // Reset active gid when URL changes
  useEffect(() => {
    setActiveGid(urlGid);
    setSheets([]);
    setRows(null);
    setExpandedRows(new Set());
  }, [urlSid]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleRow = useCallback((ri: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(ri)) next.delete(ri); else next.add(ri);
      return next;
    });
  }, []);

  const hasToken = !!driveStore.getToken();

  // Load all sheets metadata
  useEffect(() => {
    if (!urlSid) return;
    const token = driveStore.getToken();
    if (!token) return;
    fetchAllSheets(urlSid, token).then(setSheets);
  }, [urlSid]);

  // Load cell formatting (colors + dropdowns)
  useEffect(() => {
    if (!urlSid) return;
    const token = driveStore.getToken();
    if (!token) return;
    setFormatting([]);
    fetchSheetFormatting(urlSid, activeGid, token).then(setFormatting);
  }, [urlSid, activeGid]);

  // Load CSV for active sheet
  useEffect(() => {
    const token = driveStore.getToken();
    if (!token) { setError("no_token"); setLoading(false); return; }
    if (!urlSid) { setError("URL invalide"); setLoading(false); return; }

    setSpreadsheetId(urlSid);
    setLoading(true);
    setRows(null);

    driveStore.checkTokenScopes().then(scopes => {
      if (scopes && !scopes.includes("spreadsheets")) setMissingScope(true);
    });

    fetch(
      `https://docs.google.com/spreadsheets/d/${urlSid}/export?format=csv&gid=${activeGid}`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => {
        if (r.status === 401) { driveStore.handleExpiredToken(); throw new Error("401"); }
        if (!r.ok) throw new Error(`${r.status}`);
        return r.text();
      })
      .then(text => {
        const parsed = parseCSV(text);
        setRows(parsed);
        if (parsed[0]) setColWidths(parsed[0].map(h =>
          h.toLowerCase().trim() === "produits" ? DEFAULT_COL * 3 : DEFAULT_COL
        ));
        setLoading(false);
      })
      .catch(e => {
        setError(`Erreur ${e.message}`);
        setLoading(false);
      });
  }, [urlSid, activeGid, refreshKey]);

  const handleCellBlur = useCallback(
    async (e: React.FocusEvent<HTMLDivElement>, rowIdx: number, colIdx: number) => {
      if (!spreadsheetId) return;
      const newValue = e.currentTarget.innerText;
      const original = rows![rowIdx + 1]?.[colIdx] ?? "";
      if (newValue === original) return;

      const key = `${rowIdx}-${colIdx}`;
      setSaving(key);

      // Use gid directly as numeric sheetId — no fetchSheetName needed
      const result = await driveStore.updateSheetCell(spreadsheetId, activeGid, rowIdx, colIdx, newValue);

      setSaving(null);

      if (result === true) {
        setRows(prev => {
          if (!prev) return prev;
          const next = prev.map(r => [...r]);
          if (!next[rowIdx + 1]) next[rowIdx + 1] = [];
          next[rowIdx + 1][colIdx] = newValue;
          return next;
        });
        toast.success("Cellule sauvegardée");
      } else {
        const code = typeof result === "string" ? result : "?";
        if (code === "401") {
          toast.error("Token expiré — déconnecte et reconnecte Drive");
        } else if (code === "403") {
          toast.error("Permission refusée (403) — vérifie les scopes OAuth");
        } else {
          // Diagnose: check if spreadsheets scope is actually in the token
          driveStore.checkTokenScopes().then(scopes => {
            if (scopes && !scopes.includes("spreadsheets")) {
              toast.error("Scope manquant — déconnecte-toi et reconnecte Drive pour autoriser l'édition Sheets", { duration: 8000 });
            } else {
              toast.error(`Erreur ${code} — le fichier doit être un Google Sheets natif (pas Excel). Vérifie la console F12.`, { duration: 8000 });
            }
          });
        }
        if (e.currentTarget) e.currentTarget.innerText = original;
      }
    },
    [spreadsheetId, activeGid, rows]
  );

  const handleCellClick = useCallback((ri: number, ci: number) => {
    setSelectedCell({ ri, ci });
  }, []);

  const handleDropdownChange = useCallback(async (value: string, rowIdx: number, colIdx: number) => {
    if (!spreadsheetId) return;
    const key = `${rowIdx}-${colIdx}`;
    setSaving(key);
    const result = await driveStore.updateSheetCell(spreadsheetId, activeGid, rowIdx, colIdx, value);
    setSaving(null);
    if (result === true) {
      setRows(prev => {
        if (!prev) return prev;
        const next = prev.map(r => [...r]);
        if (!next[rowIdx + 1]) next[rowIdx + 1] = [];
        next[rowIdx + 1][colIdx] = value;
        return next;
      });
    }
  }, [spreadsheetId, activeGid]);

  // Sync format pickers when selected cell changes
  useEffect(() => {
    if (!selectedCell) return;
    const meta = formatting[selectedCell.ri + 1]?.[selectedCell.ci] ?? {};
    if (meta.bgColor) setFmtBg(rgbStringToHex(meta.bgColor));
    if (meta.textColor) setFmtText(rgbStringToHex(meta.textColor));
  }, [selectedCell, formatting]);

  const applyFormat = useCallback(async (fmt: { bgColor?: string; textColor?: string; fontSize?: number }) => {
    if (!selectedCell || !spreadsheetId) return;
    setFmtApplying(true);
    const ok = await driveStore.updateSheetCellFormat(spreadsheetId, activeGid, selectedCell.ri, selectedCell.ci, fmt);
    setFmtApplying(false);
    if (ok) {
      const token = driveStore.getToken();
      if (token) fetchSheetFormatting(spreadsheetId, activeGid, token).then(setFormatting);
    } else {
      toast.error("Erreur lors de l'application du format");
    }
  }, [selectedCell, spreadsheetId, activeGid]);

  const startResize = (e: React.MouseEvent, col: number) => {
    e.preventDefault();
    resizing.current = { col, startX: e.clientX, startW: colWidths[col] ?? DEFAULT_COL };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientX - resizing.current.startX;
      setColWidths(prev => {
        const next = [...prev];
        next[resizing.current!.col] = Math.max(MIN_COL, resizing.current!.startW + delta);
        return next;
      });
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── States ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (error === "no_token") return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <LogIn className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Connecte ton Google Drive pour afficher ce tableau</p>
      <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>Ouvrir dans Google Sheets</Button>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-destructive">{error}</p>
      <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>Ouvrir dans Google Sheets</Button>
    </div>
  );

  if (!rows || rows.length === 0) return (
    <p className="text-center text-muted-foreground py-8 text-sm">Feuille vide</p>
  );

  const [headers, ...dataRows] = rows;
  const maxCols = Math.max(headers.length, ...dataRows.map(r => r.length));
  const allHeaders = Array.from({ length: maxCols }, (_, i) => headers[i] ?? "");
  const totalDataRows = dataRows.length + EXTRA_ROWS;

  const colExempleConcurrent = allHeaders.findIndex(h => h.toLowerCase().trim() === "exemple concurrent");
  const colLienProduits = allHeaders.findIndex(h => h.toLowerCase().trim() === "lien produits");
  const colProduits = allHeaders.findIndex(h => h.toLowerCase().trim() === "produits");
  const colNumero = allHeaders.findIndex(h => h.trim() === "n°");
  const currentSheetTitle = sheets.find(s => String(s.sheetId) === activeGid)?.title ?? "";

  return (
    <div className="flex flex-col h-full">
      {/* Onglets feuilles */}
      {sheets.length > 1 && (
        <div className="flex overflow-x-auto scrollbar-none border-b border-border bg-secondary/10 flex-shrink-0">
          {sheets.map(s => (
            <button
              key={s.sheetId}
              onClick={() => { setActiveGid(String(s.sheetId)); setExpandedRows(new Set()); }}
              className={`px-3 h-8 text-xs whitespace-nowrap flex-shrink-0 transition-colors border-b-2 ${
                activeGid === String(s.sheetId)
                  ? "border-primary text-foreground font-medium bg-background"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      {/* Statut édition */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-background flex-shrink-0">
        <button
          onClick={() => { setLoading(true); setRows(null); setRefreshKey(k => k + 1); }}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded flex-shrink-0"
          title="Actualiser"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        {hasToken && missingScope ? (
          <>
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs text-destructive">Scope manquant — </span>
            <button
              className="text-xs text-primary underline"
              onClick={() => { driveStore.logout(); window.location.reload(); }}
            >déconnecte et reconnecte Drive</button>
            <span className="text-xs text-destructive"> pour autoriser l'édition</span>
          </>
        ) : hasToken ? (
          <>
            <Save className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs text-green-400">Édition activée — clique sur une cellule pour modifier</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-amber-400">Lecture seule — connecte Drive pour activer l'édition</span>
          </>
        )}
      </div>

      {/* Barre de mise en forme cellule */}
      {hasToken && (
        <div className="flex flex-col border-b border-border bg-background flex-shrink-0">
          {/* Ligne 1 : référence + pickers + taille + favoris */}
          <div className="flex items-center gap-1.5 px-3 py-1 flex-wrap">
            <Palette className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground min-w-[48px]">
              {selectedCell ? `L${selectedCell.ri + 1} C${selectedCell.ci + 1}` : "—"}
            </span>
            {fmtApplying && <Loader2 className="h-3 w-3 animate-spin text-primary flex-shrink-0" />}
            <div className="w-px h-3.5 bg-border flex-shrink-0" />

            {/* Couleur de fond */}
            <label
              className="flex items-center gap-1 cursor-pointer group text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Couleur de fond — appliquée 600ms après sélection"
            >
              <div className="w-4 h-4 rounded border border-border flex-shrink-0 shadow-sm" style={{ backgroundColor: fmtBg }} />
              <span>Fond</span>
              <input
                type="color"
                className="sr-only"
                value={fmtBg}
                onChange={e => {
                  const v = e.target.value;
                  setFmtBg(v);
                  latestBg.current = v;
                  if (applyBgTimer.current) clearTimeout(applyBgTimer.current);
                  applyBgTimer.current = setTimeout(() => {
                    if (selectedCell) applyFormat({ bgColor: latestBg.current });
                  }, 600);
                }}
              />
            </label>

            {/* Couleur du texte */}
            <label
              className="flex items-center gap-1 cursor-pointer group text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Couleur du texte — appliquée 600ms après sélection"
            >
              <span className="text-sm font-bold border-b-2 leading-none px-0.5" style={{ color: fmtText, borderColor: fmtText }}>A</span>
              <span>Texte</span>
              <input
                type="color"
                className="sr-only"
                value={fmtText}
                onChange={e => {
                  const v = e.target.value;
                  setFmtText(v);
                  latestText.current = v;
                  if (applyTextTimer.current) clearTimeout(applyTextTimer.current);
                  applyTextTimer.current = setTimeout(() => {
                    if (selectedCell) applyFormat({ textColor: latestText.current });
                  }, 600);
                }}
              />
            </label>

            <div className="w-px h-3.5 bg-border flex-shrink-0" />

            {/* Taille de police */}
            <select
              className="text-xs bg-secondary border border-border rounded px-1 h-5 outline-none cursor-pointer"
              onChange={e => { if (e.target.value) { applyFormat({ fontSize: Number(e.target.value) }); e.currentTarget.value = ""; } }}
              defaultValue=""
            >
              <option value="" disabled>Taille</option>
              {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24].map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {!selectedCell && <span className="text-xs text-muted-foreground/40 ml-1">← sélectionne une cellule</span>}

            <div className="w-px h-3.5 bg-border flex-shrink-0 ml-auto" />

            {/* Favoris */}
            <Star className="h-3 w-3 text-amber-400 flex-shrink-0" />
            {favorites.map((fav, i) => (
              <button
                key={i}
                className="w-4 h-4 rounded border border-border/60 flex-shrink-0 hover:scale-125 transition-transform"
                style={{ backgroundColor: fav }}
                title={`${fav} — clic: fond | Shift+clic: texte | clic droit: supprimer`}
                onClick={e => {
                  if (e.shiftKey) { setFmtText(fav); applyFormat({ textColor: fav }); }
                  else { setFmtBg(fav); applyFormat({ bgColor: fav }); }
                }}
                onContextMenu={e => { e.preventDefault(); setFavorites(removeFavorite(fav)); }}
              />
            ))}
            <button
              className="w-4 h-4 rounded border border-dashed border-border/60 flex-shrink-0 hover:scale-125 transition-transform flex items-center justify-center"
              style={{ backgroundColor: fmtBg }}
              title={`Sauvegarder ${fmtBg} dans les favoris`}
              onClick={() => setFavorites(addFavorite(fmtBg))}
            >
              <span className="text-[9px] leading-none font-bold" style={{ color: fmtBg === "#ffffff" ? "#888" : "#fff", textShadow: "0 0 2px rgba(0,0,0,0.4)" }}>+</span>
            </button>
          </div>

          {/* Ligne 2 : palette rapide */}
          <div className="flex items-center gap-1 px-3 pb-1.5">
            <span className="text-[10px] text-muted-foreground/50 mr-1 flex-shrink-0">Rapide :</span>
            {QUICK_COLORS.map(c => (
              <button
                key={c.value}
                className="w-4 h-4 rounded-sm border border-border/40 flex-shrink-0 hover:scale-125 transition-transform"
                style={{ backgroundColor: c.value }}
                title={`${c.label} (${c.value}) — clic: fond | Shift+clic: texte`}
                onClick={e => {
                  if (e.shiftKey) { setFmtText(c.value); applyFormat({ textColor: c.value }); }
                  else { setFmtBg(c.value); applyFormat({ bgColor: c.value }); }
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tableau */}
      <div className="overflow-auto flex-1" style={{ backgroundColor: "#ffffff" }}>
        <table className="text-xs border-collapse" style={{ tableLayout: "fixed", width: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th
                className="border border-border select-none"
                style={{ width: 32, minWidth: 32, height: CELL_HEIGHT, backgroundColor: "#f1f3f4" }}
              />
              {allHeaders.map((h, i) => (
                <th
                  key={i}
                  className="relative text-left px-2 border border-border font-semibold whitespace-nowrap select-none"
                  style={{ width: colWidths[i] ?? DEFAULT_COL, minWidth: MIN_COL, height: CELL_HEIGHT, backgroundColor: "#f1f3f4", color: "#444746" }}
                >
                  <span className="block truncate">{h}</span>
                  <div
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/50"
                    onMouseDown={(e) => startResize(e, i)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: totalDataRows }, (_, ri) => {
              const row = dataRows[ri] ?? [];
              const isEmpty = ri >= dataRows.length;
              const isExpanded = expandedRows.has(ri);
              // Check if any cell in this row has text content worth expanding
              const hasLongText = row.some(v => v && !isUrl(v) && v.length > 14);
              const isRowSelected = selectedRow === ri;

              return (
                <tr
                  key={ri}
                  onClick={() => setSelectedRow(ri)}
                  className={`transition-colors group/row cursor-pointer ${isEmpty ? "opacity-50 hover:opacity-100" : ""}`}
                >
                  {/* Numéro de ligne — survol : bouton import (si dispo) sinon numéro seul */}
                  <td
                    className="border border-border text-center cursor-pointer select-none relative"
                    style={{
                      width: 32,
                      minWidth: 32,
                      height: isExpanded ? undefined : CELL_HEIGHT,
                      backgroundColor: isRowSelected ? "#7c3aed" : "#f1f3f4",
                      color: isRowSelected ? "#ffffff" : "#444746",
                      fontSize: 10,
                      fontWeight: isRowSelected ? 700 : 400,
                    }}
                    onClick={(e) => { e.stopPropagation(); setSelectedRow(prev => prev === ri ? null : ri); }}
                    title={isRowSelected ? "Désélectionner la ligne" : "Sélectionner la ligne"}
                  >
                    {isEmpty ? "" : (
                      <>
                        <span className={onImportRow ? "group-hover/row:hidden" : ""}>{ri + 1}</span>
                        {onImportRow && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onImportRow({
                              etsy_lien: colExempleConcurrent >= 0 ? (row[colExempleConcurrent] ?? "") : "",
                              lien_ali: colLienProduits >= 0 ? (row[colLienProduits] ?? "") : "",
                              categorie: colProduits >= 0 ? (row[colProduits] ?? "") : "",
                              nom_du_produit: colProduits >= 0 ? (row[colProduits] ?? "") : "",
                              boutique_nom: currentSheetTitle,
                              fiche_numero: colNumero >= 0 ? (row[colNumero] ?? "") : "",
                            }); }}
                            className="hidden group-hover/row:flex items-center justify-center w-full h-full absolute inset-0 hover:text-primary transition-colors"
                            title="Importer dans Génération Fiche"
                          >
                            <PackagePlus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </td>
                  {allHeaders.map((_, ci) => {
                    const val = row[ci] ?? "";
                    const key = `${ri}-${ci}`;
                    const isSaving = saving === key;
                    const meta = formatting[ri + 1]?.[ci] ?? {};
                    const cellBg = meta.bgColor;
                    const rowHighlight = "#c4b5fd";
                    const cellStyle = {
                      width: colWidths[ci] ?? DEFAULT_COL,
                      maxWidth: colWidths[ci] ?? DEFAULT_COL,
                      backgroundColor: isRowSelected ? rowHighlight : (cellBg ?? "#ffffff"),
                      color: meta.textColor ?? "#000000",
                      outline: selectedCell?.ri === ri && selectedCell?.ci === ci ? "2px solid hsl(var(--primary))" : undefined,
                    };

                    if (isUrl(val)) {
                      return (
                        <td
                          key={ci}
                          className="border border-border overflow-hidden"
                          style={cellStyle}
                          onClick={() => handleCellClick(ri, ci)}
                        >
                          <div className="px-2" style={{ height: CELL_HEIGHT, overflow: "hidden", display: "flex", alignItems: "center" }}>
                            <UrlCell val={val} />
                          </div>
                        </td>
                      );
                    }

                    // Dropdown cell
                    if (meta.options?.length) {
                      return (
                        <td
                          key={ci}
                          className="border border-border overflow-hidden relative"
                          style={cellStyle}
                          onClick={() => handleCellClick(ri, ci)}
                        >
                          <div className="relative flex items-center" style={{ height: CELL_HEIGHT }}>
                            <select
                              value={val}
                              disabled={!hasToken}
                              onChange={e => handleDropdownChange(e.target.value, ri, ci)}
                              className="w-full h-full border-0 outline-none text-xs cursor-pointer pl-1 pr-5 appearance-none"
                              style={{ backgroundColor: isRowSelected ? rowHighlight : (cellBg ?? "#fff"), color: "#000" }}
                            >
                              {/* Option vide pour les cellules sans valeur sélectionnée */}
                              <option value="" style={{ color: "#000", background: "#fff" }}>—</option>
                              {meta.options.map(opt => (
                                <option key={opt} value={opt} style={{ color: "#000", background: "#fff" }}>{opt}</option>
                              ))}
                            </select>
                            {isSaving
                              ? <Loader2 className="absolute right-1 h-3 w-3 animate-spin text-primary pointer-events-none" />
                              : <ChevronDown className="absolute right-1 h-3 w-3 text-muted-foreground pointer-events-none" />
                            }
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={ci}
                        className={`border border-border overflow-hidden relative ${hasToken ? "focus-within:bg-primary/5" : ""}`}
                        style={cellStyle}
                        onClick={() => handleCellClick(ri, ci)}
                      >
                        <div
                          className="px-2 flex items-start"
                          style={{
                            minHeight: CELL_HEIGHT,
                            maxHeight: isExpanded ? "none" : CELL_HEIGHT,
                            overflow: "hidden",
                          }}
                        >
                          <TextCell
                            val={val}
                            canEdit={hasToken}
                            onBlur={(e) => handleCellBlur(e, ri, ci)}
                            saving={isSaving}
                            expanded={isExpanded}
                          />
                        </div>
                        {/* Bouton copier — colonne produits */}
                        {allHeaders[ci]?.toLowerCase().trim() === "produits" && val && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(val); toast.success("Copié !"); }}
                            className="absolute top-0.5 right-0.5 text-muted-foreground hover:text-primary bg-background/80 rounded p-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity"
                            title="Copier le texte"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                        {/* Expand button — only on first cell of rows with long text, on hover */}
                        {ci === 0 && hasLongText && (
                          <button
                            onClick={() => toggleRow(ri)}
                            className="absolute bottom-0.5 right-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity text-muted-foreground hover:text-primary bg-background/80 rounded p-0.5"
                            title={isExpanded ? "Réduire" : "Développer"}
                          >
                            {isExpanded
                              ? <ChevronUp className="h-3 w-3" />
                              : <ChevronDown className="h-3 w-3" />}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
