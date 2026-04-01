import { useState, useRef, useCallback } from "react";
import { Table2, Store, Package, FileText, X, ChevronUp } from "lucide-react";
import { SheetsViewer } from "./SheetsViewer";
import { NotepadViewer } from "./NotepadViewer";

const TABS = [
  {
    id: "prompt",
    title: "Bloc Note",
    icon: FileText,
    url: "https://docs.google.com/document/d/1h9iRZWZSMjeu8aec_cVFFl0K24oBVR1HDZqhcjWErko/edit?tab=t.0",
    type: "doc" as const,
  },
  {
    id: "boutique",
    title: "Liste Boutique",
    icon: Store,
    url: "https://docs.google.com/spreadsheets/d/1cetIf0cfWDxz-geTmatUOBchdjUUpCvS/edit?gid=1536179428#gid=1536179428",
    type: "sheet" as const,
  },
  {
    id: "commande",
    title: "Suivi Commande",
    icon: Package,
    url: "https://docs.google.com/spreadsheets/d/1kM5fQ_3upj86gdlw0-1w9kUqavodpi6XOlM05sExe9g/edit?gid=495771845#gid=495771845",
    type: "sheet" as const,
  },
  {
    id: "tableau",
    title: "Tableau Contrôle",
    icon: Table2,
    url: "https://docs.google.com/spreadsheets/d/1u3_-YtIYqCnO2YEPfLh1cCsjd2CcRiT1cKileCLA0Ig/edit?gid=0#gid=0",
    type: "sheet" as const,
  },
] as const;

const DEFAULT_HEIGHT = 420;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 750;

export function BottomTabs() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const resizing = useRef<{ startY: number; startH: number } | null>(null);

  const active = TABS.find(t => t.id === activeId);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = { startY: e.clientY, startH: height };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = resizing.current.startY - ev.clientY;
      setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, resizing.current.startH + delta)));
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [height]);

  const toggle = (id: string) => setActiveId(prev => prev === id ? null : id);

  return (
    <div className="flex-shrink-0 border-t border-border bg-background">
      {/* Panel */}
      {active && (
        <div style={{ height }} className="flex flex-col">
          {/* Resize handle */}
          <div
            className="h-1.5 cursor-row-resize hover:bg-primary/50 transition-colors flex-shrink-0 bg-border/60 group"
            onMouseDown={startResize}
            title="Redimensionner"
          />
          {/* Panel header */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-secondary/40 flex-shrink-0">
            <active.icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground">{active.title}</span>
            <button
              onClick={() => setActiveId(null)}
              className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
              title="Fermer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Content — key forces remount on tab switch */}
          <div key={activeId} className="flex-1 overflow-hidden">
            {active.type === "sheet" && <SheetsViewer url={active.url} />}
            {active.type === "doc" && <NotepadViewer url={active.url} />}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center h-8 px-2 gap-0.5">
        {TABS.map(tab => {
          const isActive = activeId === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => toggle(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 h-6 rounded text-xs font-medium transition-colors ${
                isActive
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <tab.icon className="h-3 w-3 flex-shrink-0" />
              <span>{tab.title}</span>
              {isActive && <ChevronUp className="h-3 w-3" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
