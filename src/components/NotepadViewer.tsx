import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, List,
  Loader2, ExternalLink, RefreshCw, CheckCheck, AlertCircle, Plus, X,
} from "lucide-react";
import { driveStore } from "@/lib/driveStore";
import { toast } from "sonner";

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

// ── Tab storage (localStorage) ────────────────────────────────────────────────

const TABS_KEY = "notepad_tabs_v2";

interface NoteTab { id: string; name: string; content: string; isDoc?: boolean }

function loadLocalTabs(): NoteTab[] {
  try {
    const s = localStorage.getItem(TABS_KEY);
    if (s) { const t = JSON.parse(s); if (Array.isArray(t) && t.length) return t; }
  } catch {}
  return [{ id: "main", name: "Bloc Note", content: "", isDoc: true }];
}
function saveLocalTabs(tabs: NoteTab[]) {
  localStorage.setItem(TABS_KEY, JSON.stringify(tabs));
}

// ── Component ─────────────────────────────────────────────────────────────────

type SyncStatus = "loading" | "saving" | "saved" | "idle" | "error" | "no_api";

export function NotepadViewer({ url }: { url: string }) {
  const [tabs, setTabs] = useState<NoteTab[]>(() => loadLocalTabs());
  const [activeId, setActiveId] = useState<string>(() => loadLocalTabs()[0]?.id ?? "main");
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docId = url.match(/document\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];

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

  // ── Load from GDoc (Drive export — no Docs API needed) ───────────────────

  const loadFromDoc = useCallback(async () => {
    if (!docId) { setStatus("idle"); return; }
    setStatus("loading");
    const raw = await driveStore.fetchDoc(docId);
    if (raw === null) { setStatus("error"); return; }

    // Google Drive export prepends the document title and tab names as the first line(s).
    // Strip any leading line that looks like a title/heading (no sentence punctuation, short).
    const lines = raw.split("\n");
    let start = 0;
    while (start < lines.length && start < 3) {
      const l = lines[start].trim();
      // Skip blank lines or short title-like lines (≤60 chars, no period/comma/colon mid-text)
      if (l === "" || (l.length <= 60 && !/[.,:;!?]/.test(l))) { start++; } else { break; }
    }
    const text = lines.slice(start).join("\n").trimStart();
    const html = text.replace(/\n/g, "<br>");

    setTabs(prev => {
      const next = prev.map(t => t.isDoc ? { ...t, content: html } : t);
      saveLocalTabs(next);
      return next;
    });

    setActiveId(prev => {
      setTimeout(() => {
        const current = loadLocalTabs().find(t => t.id === prev);
        if (current?.isDoc && editorRef.current) {
          editorRef.current.innerHTML = html;
        }
      }, 0);
      return prev;
    });
    setStatus("idle");
  }, [docId]);

  // On mount: load from GDoc for doc-linked tab
  useEffect(() => { loadFromDoc(); }, [loadFromDoc]);

  // Sync editor when switching tabs
  useEffect(() => {
    if (!editorRef.current) return;
    const tab = tabs.find(t => t.id === activeId);
    editorRef.current.innerHTML = tab?.content ?? "";
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save to GDoc ──────────────────────────────────────────────────────────

  const saveToDoc = useCallback(async (html: string) => {
    if (!docId) return;
    setStatus("saving");
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const text = tmp.innerText;
    const result = await driveStore.saveDocTab(docId, "", text);
    if (result === "no_scope") {
      // Try legacy saveDoc
      const ok = await driveStore.saveDoc(docId, text);
      if (ok) { setStatus("saved"); setTimeout(() => setStatus("idle"), 2000); }
      else { setStatus("no_api"); }
    } else if (result === true) {
      setStatus("saved"); setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("no_api");
    }
  }, [docId]);

  // ── Handle editor input ───────────────────────────────────────────────────

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;

    // Save to local state immediately
    setTabs(prev => {
      const next = prev.map(t => t.id === activeId ? { ...t, content: html } : t);
      saveLocalTabs(next);
      return next;
    });

    setStatus("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Auto-save to GDoc only for doc-linked tabs
    if (activeTab?.isDoc) {
      debounceRef.current = setTimeout(() => saveToDoc(html), 2000);
    }
  }, [activeId, activeTab, saveToDoc]);

  // ── Tab management ────────────────────────────────────────────────────────

  const snapshotCurrent = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setTabs(prev => {
      const next = prev.map(t => t.id === activeId ? { ...t, content: html } : t);
      saveLocalTabs(next);
      return next;
    });
  }, [activeId]);

  const switchTab = (id: string) => {
    if (id === activeId) return;
    snapshotCurrent();
    setActiveId(id);
  };

  const addTab = () => {
    snapshotCurrent();
    const id = `tab_${Date.now()}`;
    const newTab: NoteTab = { id, name: `Note ${tabs.length + 1}`, content: "" };
    setTabs(prev => { const next = [...prev, newTab]; saveLocalTabs(next); return next; });
    setActiveId(id);
  };

  const removeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const next = tabs.filter(t => t.id !== id);
    saveLocalTabs(next);
    setTabs(next);
    if (activeId === id) setActiveId(next[0]?.id ?? "");
  };

  const renameTab = (id: string, name: string) => {
    setTabs(prev => { const next = prev.map(t => t.id === id ? { ...t, name } : t); saveLocalTabs(next); return next; });
    setEditingTabId(null);
  };

  // ── Status bar ────────────────────────────────────────────────────────────

  const statusEl: Record<SyncStatus, React.ReactNode> = {
    loading: <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Chargement…</span></>,
    saving:  <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span className="text-primary">Sauvegarde…</span></>,
    saved:   <><CheckCheck className="h-3.5 w-3.5 text-green-400" /><span className="text-green-400">Synchronisé ✓</span></>,
    idle:    <><CheckCheck className="h-3.5 w-3.5 text-muted-foreground/60" /><span className="text-muted-foreground/60">{activeTab?.isDoc ? "Connecté au GDoc" : "Note locale"}</span></>,
    error:   <><AlertCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-destructive">Erreur de lecture</span></>,
    no_api:  <><AlertCircle className="h-3.5 w-3.5 text-amber-400" /><span className="text-amber-400">Active l'API Google Docs dans Cloud Console</span></>,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-secondary/20 flex-shrink-0 overflow-x-auto">
        <div className="flex items-center flex-nowrap flex-1 min-w-0">
          {tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-1 px-3 h-8 text-xs font-medium whitespace-nowrap border-r border-border cursor-pointer select-none flex-shrink-0 transition-colors group/tab ${
                activeId === tab.id ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {editingTabId === tab.id ? (
                <input
                  autoFocus
                  defaultValue={tab.name}
                  className="bg-transparent outline-none border-b border-primary text-xs w-20"
                  onBlur={e => renameTab(tab.id, e.target.value || tab.name)}
                  onKeyDown={e => { if (e.key === "Enter") renameTab(tab.id, (e.target as HTMLInputElement).value || tab.name); e.stopPropagation(); }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span onDoubleClick={e => { e.stopPropagation(); setEditingTabId(tab.id); }}>{tab.name}</span>
              )}
              {tab.isDoc && <span className="text-primary/50 text-[9px] ml-0.5">●</span>}
              {tabs.length > 1 && (
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => removeTab(tab.id, e)}
                  className="opacity-0 group-hover/tab:opacity-100 hover:text-destructive transition-all ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={addTab}
            className="flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors flex-shrink-0 border-r border-border"
            title="Nouvel onglet"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-1 px-2 flex-shrink-0 text-xs border-l border-border h-8">
          <div className="flex items-center gap-1">{statusEl[status]}</div>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={loadFromDoc}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded ml-1"
            title="Recharger depuis Google Docs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded" title="Ouvrir dans Google Docs">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Toolbar */}
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
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10 pointer-events-none">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={status !== "loading"}
          suppressContentEditableWarning
          onInput={handleInput}
          className="h-full p-4 outline-none text-sm text-foreground overflow-auto leading-relaxed"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
