import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, List,
  Save, Loader2, ExternalLink, RefreshCw, CheckCheck, AlertCircle,
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

type SyncStatus = "idle" | "loading" | "saving" | "saved" | "error";

// ── Component ─────────────────────────────────────────────────────────────────

export function NotepadViewer({ url }: { url: string }) {
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
    const fragment = range.extractContents();
    const span = document.createElement("span");
    span.style.fontSize = px;
    span.appendChild(fragment);
    range.insertNode(span);
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(span);
    sel.addRange(r);
  };

  // ── Load from GDoc ────────────────────────────────────────────────────────

  const loadFromDoc = useCallback(async () => {
    if (!docId) return;
    setStatus("loading");
    const text = await driveStore.fetchDoc(docId);
    if (text === null) {
      setStatus("error");
      return;
    }
    if (editorRef.current) {
      editorRef.current.innerHTML = text.replace(/\n/g, "<br>");
    }
    setStatus("idle");
  }, [docId]);

  useEffect(() => {
    loadFromDoc();
  }, [loadFromDoc]);

  // ── Auto-save to GDoc (debounced 2s) ─────────────────────────────────────

  const saveToDoc = useCallback(async () => {
    if (!docId || !editorRef.current) return;
    setStatus("saving");
    const tmp = document.createElement("div");
    tmp.innerHTML = editorRef.current.innerHTML;
    const text = tmp.innerText;
    const ok = await driveStore.saveDoc(docId, text);
    if (ok) {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
      toast.error("Sauvegarde échouée — déconnecte et reconnecte Drive");
    }
  }, [docId]);

  const handleInput = useCallback(() => {
    setStatus("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveToDoc(), 2000);
  }, [saveToDoc]);

  // ── Render ────────────────────────────────────────────────────────────────

  const statusEl = {
    loading: <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Chargement…</span></>,
    saving:  <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span className="text-primary">Sauvegarde…</span></>,
    saved:   <><CheckCheck className="h-3.5 w-3.5 text-green-400" /><span className="text-green-400">Synchronisé</span></>,
    error:   <><AlertCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-destructive">Erreur — reconnecte Drive</span></>,
    idle:    <><Save className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Connecté à Google Docs</span></>,
  }[status];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-secondary/10 flex-shrink-0 text-xs">
        <div className="flex items-center gap-1.5 flex-1">{statusEl}</div>
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={loadFromDoc}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          title="Recharger depuis Google Docs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded" title="Ouvrir dans Google Docs">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
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
      <div
        ref={editorRef}
        contentEditable={status !== "loading"}
        suppressContentEditableWarning
        onInput={handleInput}
        className={`flex-1 p-4 outline-none text-sm text-foreground overflow-auto leading-relaxed ${status === "loading" ? "opacity-40 pointer-events-none" : ""}`}
        spellCheck={false}
      />
    </div>
  );
}
