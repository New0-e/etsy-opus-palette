import { useRef, useCallback } from "react";
import { X, ChevronUp, ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { SheetsViewer } from "./SheetsViewer";
import { NotepadViewer } from "./NotepadViewer";
import { BOTTOM_TABS, BottomTabId } from "@/lib/bottomTabsConfig";
import { useState } from "react";

const DEFAULT_HEIGHT = 420;
const MIN_HEIGHT = 160;
const TAB_BAR_H = 34;
const MOBILE_TOP_H = 44;

type Props = {
  activeId: BottomTabId | null;
  onActiveChange: (id: BottomTabId | null) => void;
};

export function BottomTabs({ activeId, onActiveChange }: Props) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [maximized, setMaximized] = useState(false);
  const prevHeightRef = useRef(DEFAULT_HEIGHT);
  const resizing = useRef<{ startY: number; startH: number } | null>(null);

  const active = BOTTOM_TABS.find(t => t.id === activeId);
  const maxHeight = () => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    return window.innerHeight - TAB_BAR_H - (isMobile ? MOBILE_TOP_H : 0);
  };

  const toggleMaximize = () => {
    if (maximized) {
      setHeight(prevHeightRef.current);
      setMaximized(false);
    } else {
      prevHeightRef.current = height;
      setHeight(maxHeight());
      setMaximized(true);
    }
  };

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = { startY: e.clientY, startH: height };
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = resizing.current.startY - ev.clientY;
      const newH = Math.max(MIN_HEIGHT, Math.min(maxHeight(), resizing.current.startH + delta));
      setHeight(newH);
      setMaximized(newH >= maxHeight() - 10);
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [height]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: BottomTabId) => onActiveChange(activeId === id ? null : id);

  return (
    <div className="flex-shrink-0 border-t border-border bg-background">
      {/* Panel */}
      {active && (
        <div
          className={maximized ? "absolute inset-0 z-50 bg-background flex flex-col" : "flex flex-col"}
          style={maximized ? {} : { height }}
        >
          {/* Resize handle */}
          {!maximized && (
            <div
              className="h-1.5 cursor-row-resize hover:bg-primary/50 transition-colors flex-shrink-0 bg-border/60 group"
              onMouseDown={startResize}
              title="Redimensionner"
            />
          )}
          {/* Panel header */}
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-secondary/40 flex-shrink-0">
            <active.icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground">{active.title}</span>
            <div className="ml-auto flex items-center gap-1">
              {active.url && (
                <a
                  href={active.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                  title="Ouvrir dans Google"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                onClick={toggleMaximize}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                title={maximized ? "Réduire" : "Plein écran"}
              >
                {maximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => { onActiveChange(null); setMaximized(false); }}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                title="Fermer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {/* Content */}
          <div key={activeId} className="flex-1 overflow-hidden">
            {active.type === "sheet" && <SheetsViewer url={active.url} />}
            {active.type === "doc" && <NotepadViewer />}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center h-8 px-2 gap-0.5 overflow-x-auto scrollbar-none">
        {BOTTOM_TABS.map(tab => {
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
