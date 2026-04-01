import { useState, useRef, useEffect, useCallback } from "react";
import { Bold, Italic, Underline, Plus, X, Save, Loader2, ExternalLink, Strikethrough, AlignLeft, AlignCenter, AlignRight, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { driveStore } from "@/lib/driveStore";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NoteTab {
  id: string;
  name: string;
  content: string;
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "notepad_tabs_v1";

function loadTabs(): NoteTab[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) { const t = JSON.parse(s); if (Array.isArray(t) && t.length) return t; }
  } catch {}
  return [{ id: "main", name: "Bloc Note", content: "" }];
}

function persistTabs(tabs: NoteTab[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
}

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

// ── Component ─────────────────────────────────────────────────────────────────

export function NotepadViewer({ url }: { url: string }) {
  const [tabs, setTabs] = useState<NoteTab[]>(loadTabs);
  const [activeId, setActiveId] = useState<string>(() => loadTabs()[0]?.id ?? "main");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const docId = url.match(/document\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;

  const activeTab = tabs.find(t => t.id === activeId) ?? tabs[0];

  // Load from Google Doc on first mount if main tab is empty
  useEffect(() => {
    const main = loadTabs().find(t => t.id === "main");
    if (!docId || main?.content) return;
    setLoading(true);
    driveStore.fetchDoc(docId).then(text => {
      if (text?.trim()) {
        const html = text.replace(/\n/g, "<br>");
        setTabs(prev => {
          const next = prev.map(t => t.id === "main" ? { ...t, content: html } : t);
          persistTabs(next);
          return next;
        });
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync editor DOM when switching tabs
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = activeTab?.content ?? "";
      editorRef.current.focus();
    }
  }, [activeId]);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setTabs(prev => {
      const next = prev.map(t => t.id === activeId ? { ...t, content: html } : t);
      persistTabs(next);
      return next;
    });
    setDirty(true);
  }, [activeId]);

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
    const fragment = range.extractContents();
    const span = document.createElement("span");
    span.style.fontSize = px;
    span.appendChild(fragment);
    range.insertNode(span);
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);
    handleInput();
  };

  // ── Tab management ──────────────────────────────────────────────────────────

  const addTab = () => {
    // Save current editor content first
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setTabs(prev => {
        const next = prev.map(t => t.id === activeId ? { ...t, content: html } : t);
        persistTabs(next);
        return next;
      });
    }
    const id = `tab_${Date.now()}`;
    const n = tabs.length + 1;
    const newTab: NoteTab = { id, name: `Note ${n}`, content: "" };
    setTabs(prev => { const next = [...prev, newTab]; persistTabs(next); return next; });
    setActiveId(id);
  };

  const switchTab = (id: string) => {
    // Save current before switching
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setTabs(prev => {
        const next = prev.map(t => t.id === activeId ? { ...t, content: html } : t);
        persistTabs(next);
        return next;
      });
    }
    setActiveId(id);
    setDirty(false);
  };

  const removeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const next = tabs.filter(t => t.id !== id);
    persistTabs(next);
    setTabs(next);
    if (activeId === id) setActiveId(next[0]?.id ?? "main");
  };

  const handleSave = async () => {
    if (!docId || !activeTab) return;
    // Save current editor HTML first
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setTabs(prev => {
        const next = prev.map(t => t.id === activeId ? { ...t, content: html } : t);
        persistTabs(next);
        return next;
      });
    }
    setSaving(true);
    const tmp = document.createElement("div");
    tmp.innerHTML = activeTab.content;
    const text = tmp.innerText;
    const ok = await driveStore.saveDoc(docId, text);
    setSaving(false);
    if (ok) { toast.success("Sauvegardé dans Google Doc"); setDirty(false); }
    else toast.error("Reconnecte Drive (déconnecte → reconnecte) pour sauvegarder");
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-secondary/20 flex-shrink-0 overflow-x-auto min-h-0">
        <div className="flex items-center flex-nowrap">
          {tabs.map(tab => (
            <div
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 h-8 text-xs font-medium whitespace-nowrap border-r border-border cursor-pointer select-none flex-shrink-0 transition-colors ${
                activeId === tab.id
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <span>{tab.name}</span>
              {tabs.length > 1 && (
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => removeTab(tab.id, e)}
                  className="hover:text-destructive transition-colors"
                  title="Fermer"
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
        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 px-2 flex-shrink-0">
          <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground p-1 transition-colors" title="Ouvrir dans Google Docs">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="h-6 text-xs px-2 gap-1"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            {saving ? "…" : "Sync Doc"}
          </Button>
        </div>
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-secondary/10 flex-shrink-0 flex-wrap">
        {/* Text style */}
        <ToolBtn onClick={() => exec("bold")} title="Gras (Ctrl+B)">
          <Bold className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("italic")} title="Italique (Ctrl+I)">
          <Italic className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("underline")} title="Souligné (Ctrl+U)">
          <Underline className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("strikeThrough")} title="Barré">
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Font size */}
        <select
          onMouseDown={e => e.stopPropagation()}
          onChange={e => { if (e.target.value) setFontSize(e.target.value); }}
          className="text-xs bg-secondary border border-border rounded px-1 h-6 outline-none cursor-pointer text-foreground"
          defaultValue=""
          title="Taille du texte"
        >
          <option value="" disabled>Taille</option>
          <option value="10px">10</option>
          <option value="12px">12</option>
          <option value="14px">14</option>
          <option value="16px">16</option>
          <option value="18px">18</option>
          <option value="20px">20</option>
          <option value="24px">24</option>
          <option value="28px">28</option>
          <option value="32px">32</option>
          <option value="40px">40</option>
        </select>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Text color */}
        <label className="relative w-6 h-6 flex items-center justify-center rounded hover:bg-secondary cursor-pointer transition-colors" title="Couleur du texte">
          <span className="text-xs font-bold text-foreground leading-none">A</span>
          <input
            type="color"
            className="absolute opacity-0 w-0 h-0"
            onChange={e => exec("foreColor", e.target.value)}
          />
        </label>

        {/* Highlight */}
        <label className="relative w-6 h-6 flex items-center justify-center rounded hover:bg-secondary cursor-pointer transition-colors" title="Couleur de surligneur">
          <span className="text-xs font-bold leading-none" style={{ background: "linear-gradient(transparent 50%, #fef08a 50%)", WebkitBackgroundClip: "text", color: "transparent" }}>A</span>
          <input
            type="color"
            className="absolute opacity-0 w-0 h-0"
            defaultValue="#fef08a"
            onChange={e => exec("hiliteColor", e.target.value)}
          />
        </label>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Alignment */}
        <ToolBtn onClick={() => exec("justifyLeft")} title="Aligner à gauche">
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("justifyCenter")} title="Centrer">
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolBtn>
        <ToolBtn onClick={() => exec("justifyRight")} title="Aligner à droite">
          <AlignRight className="h-3.5 w-3.5" />
        </ToolBtn>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* List */}
        <ToolBtn onClick={() => exec("insertUnorderedList")} title="Liste à puces">
          <List className="h-3.5 w-3.5" />
        </ToolBtn>
      </div>

      {/* Editor */}
      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          className="flex-1 p-4 outline-none text-sm text-foreground overflow-auto leading-relaxed"
          style={{ minHeight: 0 }}
          spellCheck={false}
        />
      )}
    </div>
  );
}
