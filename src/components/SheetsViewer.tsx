import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, LogIn, Save, AlertCircle, ExternalLink, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { driveStore } from "@/lib/driveStore";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

async function fetchSheetName(spreadsheetId: string, gid: string, token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title))`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const sheet = data.sheets?.find((s: any) => String(s.properties.sheetId) === gid);
    return sheet?.properties?.title ?? data.sheets?.[0]?.properties?.title ?? null;
  } catch {
    return null;
  }
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
        className={`outline-none flex-1 text-xs text-foreground min-w-0 ${expanded ? "whitespace-pre-wrap break-words" : "truncate"} ${canEdit ? "cursor-text" : ""}`}
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

export function SheetsViewer({ url }: { url: string }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [gidRef, setGidRef] = useState("0");
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [colWidths, setColWidths] = useState<number[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const resizing = useRef<{ col: number; startX: number; startW: number } | null>(null);

  const toggleRow = useCallback((ri: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(ri)) next.delete(ri); else next.add(ri);
      return next;
    });
  }, []);

  const hasToken = !!driveStore.getToken();

  useEffect(() => {
    const token = driveStore.getToken();
    if (!token) { setError("no_token"); setLoading(false); return; }

    const { spreadsheetId: sid, gid } = extractIds(url);
    if (!sid) { setError("URL invalide"); setLoading(false); return; }
    setSpreadsheetId(sid);
    setGidRef(gid);

    Promise.allSettled([
      fetch(
        `https://docs.google.com/spreadsheets/d/${sid}/export?format=csv&gid=${gid}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.text(); }),
      fetchSheetName(sid, gid, token),
    ]).then(([csvResult, metaResult]) => {
      if (csvResult.status === "fulfilled") {
        const parsed = parseCSV(csvResult.value);
        setRows(parsed);
        if (parsed[0]) {
          setColWidths(parsed[0].map(() => DEFAULT_COL));
        }
      } else {
        setError(`Erreur ${csvResult.reason?.message ?? ""}`);
      }
      if (metaResult.status === "fulfilled" && metaResult.value) {
        setSheetName(metaResult.value);
      }
      setLoading(false);
    });
  }, [url]);

  const handleCellBlur = useCallback(
    async (e: React.FocusEvent<HTMLDivElement>, rowIdx: number, colIdx: number) => {
      if (!spreadsheetId) return;
      const newValue = e.currentTarget.innerText;
      const original = rows![rowIdx + 1]?.[colIdx] ?? "";
      if (newValue === original) return;

      const key = `${rowIdx}-${colIdx}`;
      setSaving(key);

      // Try with known sheet name first; if unavailable, try fetching it once, then fall back to no prefix
      let currentSheetName = sheetName;
      if (!currentSheetName) {
        const token = driveStore.getToken();
        if (token) {
          const name = await fetchSheetName(spreadsheetId, gidRef, token);
          if (name) { setSheetName(name); currentSheetName = name; }
        }
      }

      // Attempt save — first with sheet name (or empty fallback for first sheet)
      let result = await driveStore.updateSheetCell(spreadsheetId, currentSheetName ?? "", rowIdx, colIdx, newValue);

      // If failed and we had a sheet name, retry without it (first-sheet fallback)
      if (result !== true && currentSheetName) {
        result = await driveStore.updateSheetCell(spreadsheetId, "", rowIdx, colIdx, newValue);
      }

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
        if (code === "401") toast.error("Token expiré — déconnecte et reconnecte Drive");
        else if (code === "403") toast.error("Permission refusée (403) — vérifie les scopes OAuth et l'API Sheets");
        else if (code === "400") toast.error("Erreur 400 — plage A1 invalide");
        else toast.error(`Échec sauvegarde (${code}) — voir console`);
        e.currentTarget.innerText = original;
      }
    },
    [spreadsheetId, sheetName, gidRef, rows]
  );

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

  return (
    <div className="flex flex-col h-full">
      {/* Statut édition */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-background flex-shrink-0">
        {hasToken ? (
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

      {/* Tableau */}
      <div className="overflow-auto flex-1">
        <table className="text-xs border-collapse" style={{ tableLayout: "fixed", width: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              {allHeaders.map((h, i) => (
                <th
                  key={i}
                  className="relative text-left px-2 bg-secondary border border-border font-semibold text-muted-foreground whitespace-nowrap select-none"
                  style={{ width: colWidths[i] ?? DEFAULT_COL, minWidth: MIN_COL, height: CELL_HEIGHT }}
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

              return (
                <tr
                  key={ri}
                  className={`hover:bg-secondary/30 transition-colors group/row ${isEmpty ? "opacity-50 hover:opacity-100" : ""}`}
                >
                  {allHeaders.map((_, ci) => {
                    const val = row[ci] ?? "";
                    const key = `${ri}-${ci}`;
                    const isSaving = saving === key;

                    if (isUrl(val)) {
                      return (
                        <td
                          key={ci}
                          className="border border-border overflow-hidden"
                          style={{ width: colWidths[ci] ?? DEFAULT_COL, maxWidth: colWidths[ci] ?? DEFAULT_COL }}
                        >
                          <div className="px-2" style={{ height: CELL_HEIGHT, overflow: "hidden", display: "flex", alignItems: "center" }}>
                            <UrlCell val={val} />
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={ci}
                        className={`border border-border overflow-hidden relative ${hasToken ? "focus-within:bg-primary/5 focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary" : ""}`}
                        style={{ width: colWidths[ci] ?? DEFAULT_COL, maxWidth: colWidths[ci] ?? DEFAULT_COL }}
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
