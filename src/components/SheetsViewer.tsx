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

function UrlCell({ val }: { val: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex items-center gap-1 min-w-0">
      {expanded ? (
        <span className="text-xs text-muted-foreground break-all flex-1">{val}</span>
      ) : (
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
      )}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={() => { navigator.clipboard.writeText(val); toast.success("Copié !"); }}
          className="text-muted-foreground hover:text-foreground p-0.5 rounded"
          title="Copier"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-muted-foreground hover:text-foreground p-0.5 rounded"
          title={expanded ? "Réduire" : "Voir complet"}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>
    </div>
  );
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

// ── Component ─────────────────────────────────────────────────────────────────

const MIN_COL = 60;
const DEFAULT_COL = 150;
const URL_COL = 200;

export function SheetsViewer({ url }: { url: string }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [colWidths, setColWidths] = useState<number[]>([]);
  const [saving, setSaving] = useState<string | null>(null); // "row-col" key
  const resizing = useRef<{ col: number; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const token = driveStore.getToken();
    if (!token) { setError("no_token"); setLoading(false); return; }

    const { spreadsheetId: sid, gid } = extractIds(url);
    if (!sid) { setError("URL invalide"); setLoading(false); return; }
    setSpreadsheetId(sid);

    // Fetch CSV + sheet metadata in parallel
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
        // Auto column widths based on header length + content
        if (parsed[0]) {
          const widths = parsed[0].map((h, i) => {
            // Check if any cell in this col looks like a URL
            const hasUrl = parsed.slice(1).some(r => isUrl(r[i] ?? ""));
            if (hasUrl) return URL_COL;
            return Math.max(MIN_COL, Math.min(300, (h.length + 4) * 8));
          });
          setColWidths(widths);
        }
      } else {
        setError(`Erreur ${csvResult.reason?.message ?? ""}`);
      }
      if (metaResult.status === "fulfilled" && metaResult.value) {
        setSheetName(metaResult.value);
        setCanEdit(true);
      }
      setLoading(false);
    });
  }, [url]);

  const handleCellBlur = useCallback(
    async (e: React.FocusEvent<HTMLTableCellElement>, rowIdx: number, colIdx: number) => {
      if (!canEdit || !spreadsheetId || !sheetName) return;
      const newValue = e.currentTarget.innerText;
      const original = rows![rowIdx + 1]?.[colIdx] ?? "";
      if (newValue === original) return;

      const key = `${rowIdx}-${colIdx}`;
      setSaving(key);
      const ok = await driveStore.updateSheetCell(spreadsheetId, sheetName, rowIdx, colIdx, newValue);
      setSaving(null);

      if (ok) {
        setRows(prev => {
          if (!prev) return prev;
          const next = prev.map(r => [...r]);
          if (!next[rowIdx + 1]) next[rowIdx + 1] = [];
          next[rowIdx + 1][colIdx] = newValue;
          return next;
        });
        toast.success("Cellule sauvegardée");
      } else {
        toast.error("Échec de la sauvegarde — reconnecte Drive");
        e.currentTarget.innerText = original;
      }
    },
    [canEdit, spreadsheetId, sheetName, rows]
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

  return (
    <div className="flex flex-col h-full">
      {/* Statut édition */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-background flex-shrink-0">
        {canEdit ? (
          <>
            <Save className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs text-green-400">Édition activée — clique sur une cellule pour modifier</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-amber-400">Lecture seule — reconnecte Drive pour activer l'édition</span>
          </>
        )}
      </div>

      {/* Tableau */}
      <div className="overflow-auto flex-1">
        <table className="text-xs border-collapse" style={{ tableLayout: "fixed", minWidth: "100%" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              {allHeaders.map((h, i) => (
                <th
                  key={i}
                  className="relative text-left px-3 py-2 bg-secondary border border-border font-semibold text-muted-foreground whitespace-nowrap select-none"
                  style={{ width: colWidths[i] ?? DEFAULT_COL, minWidth: MIN_COL }}
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
            {dataRows.map((row, ri) => (
              <tr key={ri} className="hover:bg-secondary/30 transition-colors">
                {allHeaders.map((_, ci) => {
                  const val = row[ci] ?? "";
                  const key = `${ri}-${ci}`;
                  const isSaving = saving === key;

                  if (isUrl(val)) {
                    return (
                      <td
                        key={ci}
                        className="px-2 py-1.5 border border-border"
                        style={{ width: colWidths[ci] ?? DEFAULT_COL }}
                      >
                        <UrlCell val={val} />
                      </td>
                    );
                  }

                  return (
                    <td
                      key={ci}
                      className={`px-3 py-1.5 border border-border text-foreground relative ${canEdit ? "focus-within:bg-primary/5 focus-within:ring-1 focus-within:ring-primary" : ""}`}
                      style={{ width: colWidths[ci] ?? DEFAULT_COL }}
                    >
                      <div
                        contentEditable={canEdit}
                        suppressContentEditableWarning
                        onBlur={(e) => handleCellBlur(e, ri, ci)}
                        className={`outline-none block truncate ${canEdit ? "cursor-text" : ""}`}
                        title={val}
                      >
                        {val}
                      </div>
                      {isSaving && (
                        <Loader2 className="h-3 w-3 animate-spin text-primary absolute right-1 top-1/2 -translate-y-1/2" />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
