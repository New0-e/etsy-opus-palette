import { useState, useEffect, useRef } from "react";
import { Loader2, LogIn } from "lucide-react";
import { driveStore } from "@/lib/driveStore";
import { Button } from "@/components/ui/button";

function extractIds(url: string): { spreadsheetId: string | null; gid: string } {
  const idMatch = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  return { spreadsheetId: idMatch?.[1] ?? null, gid: gidMatch?.[1] ?? "0" };
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === "," && !inQ) { cells.push(cur); cur = ""; }
      else cur += c;
    }
    cells.push(cur.replace(/\r$/, ""));
    rows.push(cells);
  }
  return rows;
}

export function SheetsViewer({ url, title }: { url: string; title: string }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track column widths for resize
  const [colWidths, setColWidths] = useState<number[]>([]);
  const resizing = useRef<{ col: number; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const token = driveStore.getToken();
    if (!token) { setError("no_token"); setLoading(false); return; }

    const { spreadsheetId, gid } = extractIds(url);
    if (!spreadsheetId) { setError("URL invalide"); setLoading(false); return; }

    fetch(
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
      .then((r) => {
        if (!r.ok) throw new Error(`Erreur ${r.status}`);
        return r.text();
      })
      .then((text) => {
        const parsed = parseCSV(text);
        setRows(parsed);
        if (parsed[0]) setColWidths(parsed[0].map(() => 160));
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [url]);

  const startResize = (e: React.MouseEvent, col: number) => {
    e.preventDefault();
    resizing.current = { col, startX: e.clientX, startW: colWidths[col] };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientX - resizing.current.startX;
      setColWidths((prev) => {
        const next = [...prev];
        next[resizing.current!.col] = Math.max(60, resizing.current!.startW + delta);
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

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (error === "no_token") return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <LogIn className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Connecte ton Google Drive pour afficher ce tableau</p>
      <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>
        Ouvrir dans Google Sheets
      </Button>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <p className="text-sm text-destructive">{error}</p>
      <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>
        Ouvrir dans Google Sheets
      </Button>
    </div>
  );

  if (!rows || rows.length === 0) return (
    <p className="text-center text-muted-foreground py-8 text-sm">Feuille vide</p>
  );

  const [headers, ...dataRows] = rows;

  return (
    <div className="overflow-auto h-full">
      <table className="text-xs border-collapse" style={{ tableLayout: "fixed", minWidth: "100%" }}>
        <thead className="sticky top-0 z-10">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="relative text-left px-3 py-2 bg-secondary border border-border font-semibold text-muted-foreground whitespace-nowrap select-none"
                style={{ width: colWidths[i] ?? 160 }}
              >
                <span className="block truncate">{h}</span>
                <div
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40"
                  onMouseDown={(e) => startResize(e, i)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, i) => (
            <tr key={i} className="hover:bg-secondary/40 transition-colors">
              {headers.map((_, j) => (
                <td
                  key={j}
                  className="px-3 py-1.5 border border-border text-foreground"
                  style={{ width: colWidths[j] ?? 160 }}
                >
                  <span className="block truncate">{row[j] ?? ""}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
