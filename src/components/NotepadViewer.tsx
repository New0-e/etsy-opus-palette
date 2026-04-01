import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, List,
  Loader2, ExternalLink, RefreshCw, CheckCheck, AlertCircle, LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { driveStore } from "@/lib/driveStore";

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className="w-6 h-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}

type SyncStatus = "loading" | "saving" | "saved" | "idle" | "no_scope" | "error";

interface DocTab { id: string; title: string; text: string }

// ── Component ─────────────────────────────────────────────────────────────────

export function NotepadViewer({ url }: { url: string }) {
  const [tabs, setTabs] = useState<DocTab[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [status, setStatus] = useState<SyncStatus>("loading");
  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docId = url.match(/document\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;

  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }, []);

  const setFontSize = (px: string) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const frag = range.extractContents();
    const span = document.createElement("span");
    span.style.fontSize = px;
    span.appendChild(frag);
    range.insertNode(span);
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(span);
    sel.addRange(r);
  };

  // ── Load all GDoc tabs ────────────────────────────────────────────────────

  const loadTabs = useCallback(async () => {
    if (!docId) return;
    setStatus("loading");
    const result = await driveStore.fetchDocTabs(docId);
    if (!result) {
      setStatus("no_scope");
      return;
    }
    setTabs(result);
    const first = result[0];
    if (first) {
      setActiveId(first.id);
      if (editorRef.current) {
        editorRef.current.innerHTML = first.text.replace(/\n/g, "<br>");
      }
    }
    setStatus("idle");
  }, [docId]);

  useEffect(() => { loadTabs(); }, [loadTabs]);

  // Inject editor content when tab changes
  useEffect(() => {
    if (!activeId || !editorRef.current) return;
    const tab = tabs.find(t => t.id === activeId);
    editorRef.current.innerHTML = tab ? tab.text.replace(/\n/g, "<br>") : "";
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch tab (save current before switching) ────────────────────────────

  const switchTab = (id: string) => {
    if (id === activeId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Snapshot current editor content into tabs state
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const tmp = document.createElement("div"); tmp.innerHTML = html;
      const text = tmp.innerText;
      setTabs(prev => prev.map(t => t.id === activeId ? { ...t, text } : t));
    }
    setActiveId(id);
    setStatus("idle");
  };

  // ── Auto-save current tab to GDoc ─────────────────────────────────────────

  const saveTab = useCallback(async (tabId: string, text: string) => {
    if (!docId) return;
    setStatus("saving");
    const result = await driveStore.saveDocTab(docId, tabId, text);
    if (result === "no_scope") { setStatus("no_scope"); return; }
    if (result) { setStatus("saved"); setTimeout(() => setStatus("idle"), 2000); }
    else setStatus("error");
  }, [docId]);

  const handleInput = useCallback(() => {
    setStatus("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!editorRef.current || !activeId) return;
      const tmp = document.createElement("div");
      tmp.innerHTML = editorRef.current.innerHTML;
      saveTab(activeId, tmp.innerText);
    }, 2000);
  }, [activeId, saveTab]);

  // ── Status bar ────────────────────────────────────────────────────────────

  const statusEl: Record<SyncStatus, React.ReactNode> = {
    loading:  <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Chargement…</span></>,
    saving:   <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span className="text-primary">Sauvegarde…</span></>,
    saved:    <><CheckCheck className="h-3.5 w-3.5 text-green-400" /><span className="text-green-400">Synchronisé ✓</span></>,
    idle:     <><CheckCheck className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Connecté au Google Doc</span></>,
    error:    <><AlertCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-destructive">Erreur de sauvegarde</span></>,
    no_scope: <><AlertCircle className="h-3.5 w-3.5 text-amber-400" /><span className="text-amber-400">Reconnexion requise (permissions Documents)</span></>,
  };

  // ── No scope → reconnect screen ───────────────────────────────────────────

  if (status === "no_scope" && tabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
        <LogIn className="h-8 w-8 text-amber-400" />
        <div>
          <p className="font-medium text-foreground">Permission manquante</p>
          <p className="text-xs text-muted-foreground mt-1">Déconnecte-toi et reconnecte-toi pour accorder l'accès Google Documents.</p>
        </div>
        <Button size="sm" onClick={() => driveStore.logout()} className="gap-2">
          <LogIn className="h-4 w-4" />
          Reconnecter Drive
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tabs + status bar */}
      <div className="flex items-center border-b border-border bg-secondary/20 flex-shrink-0 overflow-x-auto">
        <div className="flex items-center flex-nowrap flex-1 min-w-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 h-8 text-xs font-medium whitespace-nowrap border-r border-border cursor-pointer select-none flex-shrink-0 transition-colors ${
                activeId === tab.id
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {tab.title}
            </button>
          ))}
        </div>
        {/* Status + actions */}
        <div className="flex items-center gap-1.5 px-2 flex-shrink-0 text-xs border-l border-border h-8">
          <div className="flex items-center gap-1">{statusEl[status]}</div>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={loadTabs}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
            title="Recharger depuis Google Docs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded" title="Ouvrir dans Google Docs">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border flex-shrink-0 flex-wrap">
        <ToolBtn onClick={() => exec("bold")} title="Gras"><Bold className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("italic")} title="Italique"><Italic className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("underline")} title="Souligné"><Underline className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("strikeThrough")} title="Barré"><Strikethrough className="h-3.5 w-3.5" /></ToolBtn>

        <div className="w-px h-4 bg-border mx-0.5" />

        <select
          onMouseDown={e => e.stopPropagation()}
          onChange={e => { if (e.target.value) { setFontSize(e.target.value); e.target.value = ""; } }}
          className="text-xs bg-secondary border border-border rounded px-1 h-6 outline-none cursor-pointer text-foreground"
          defaultValue=""
          title="Taille"
        >
          <option value="" disabled>Taille</option>
          {["10px","12px","14px","16px","18px","20px","24px","28px","32px","40px"].map(s => (
            <option key={s} value={s}>{s.replace("px","")}</option>
          ))}
        </select>

        <div className="w-px h-4 bg-border mx-0.5" />

        <label className="relative w-6 h-6 flex items-center justify-center rounded hover:bg-secondary cursor-pointer" title="Couleur texte">
          <span className="text-xs font-bold text-foreground">A</span>
          <input type="color" className="absolute opacity-0 w-0 h-0" onChange={e => exec("foreColor", e.target.value)} />
        </label>
        <label className="relative w-6 h-6 flex items-center justify-center rounded hover:bg-secondary cursor-pointer" title="Surligneur">
          <span className="text-xs font-bold" style={{ background: "linear-gradient(transparent 50%,#fef08a 50%)", WebkitBackgroundClip: "text", color: "transparent" }}>A</span>
          <input type="color" className="absolute opacity-0 w-0 h-0" defaultValue="#fef08a" onChange={e => exec("hiliteColor", e.target.value)} />
        </label>

        <div className="w-px h-4 bg-border mx-0.5" />

        <ToolBtn onClick={() => exec("justifyLeft")} title="Gauche"><AlignLeft className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("justifyCenter")} title="Centre"><AlignCenter className="h-3.5 w-3.5" /></ToolBtn>
        <ToolBtn onClick={() => exec("justifyRight")} title="Droite"><AlignRight className="h-3.5 w-3.5" /></ToolBtn>
        <div className="w-px h-4 bg-border mx-0.5" />
        <ToolBtn onClick={() => exec("insertUnorderedList")} title="Liste"><List className="h-3.5 w-3.5" /></ToolBtn>
      </div>

      {/* Editor */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={status !== "loading" && status !== "no_scope"}
          suppressContentEditableWarning
          onInput={handleInput}
          className="h-full p-4 outline-none text-sm text-foreground overflow-auto leading-relaxed"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
