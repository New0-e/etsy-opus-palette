import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, List,
  Loader2, ExternalLink, RefreshCw, CheckCheck, AlertCircle, Plus, X, Trash2, Star,
} from "lucide-react";
import { driveStore } from "@/lib/driveStore";
import { Button } from "@/components/ui/button";
import { getFavorites, addFavorite, removeFavorite } from "@/lib/colorFavorites";

// ── Constants ─────────────────────────────────────────────────────────────────

const BLOC_NOTE_PATH = ["Stockage", "Bloc_note"];

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function htmlToText(html: string): string {
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") return "\n";
    const inner = Array.from(el.childNodes).map(walk).join("");
    if (["div", "p", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
      return inner ? inner + "\n" : "\n";
    }
    return inner;
  };
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return walk(tmp).replace(/\n{3,}/g, "\n\n").trimEnd();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocFile {
  id: string;
  name: string;
  html: string;
  loaded: boolean;
}

type Status = "loading" | "saving" | "saved" | "idle" | "error" | "no_folder";

// ── Component ─────────────────────────────────────────────────────────────────

export function NotepadViewer() {
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newNameInputRef = useRef<HTMLInputElement>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [textColor, setTextColor] = useState("#000000");
  const [highlightColor, setHighlightColor] = useState("#fef08a");
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());

  // ── Load folder + list docs ───────────────────────────────────────────────

  const load = useCallback(async () => {
    setStatus("loading");
    const fid = await driveStore.resolveFolderPath(BLOC_NOTE_PATH);
    if (!fid) { setStatus("no_folder"); return; }
    setFolderId(fid);

    const files = await driveStore.listGDocsInFolder(fid);
    if (files.length === 0) {
      setDocs([]);
      setActiveId("");
      setStatus("idle");
      return;
    }

    // Load content of first doc
    const first = files[0];
    const text = await driveStore.fetchDoc(first.id);
    const html = text ? text.replace(/\n/g, "<br>") : "";

    const docFiles: DocFile[] = files.map((f, i) =>
      i === 0
        ? { id: f.id, name: f.name, html, loaded: true }
        : { id: f.id, name: f.name, html: "", loaded: false }
    );
    setDocs(docFiles);
    setActiveId(first.id);
    setStatus("idle");
  }, []);

  useEffect(() => { load(); }, [load]);

  // Inject first doc content into editor after docs load
  useEffect(() => {
    if (docs.length > 0 && editorRef.current && status === "idle") {
      const doc = docs.find(d => d.id === activeId);
      if (doc?.loaded) editorRef.current.innerHTML = doc.html;
    }
  }, [docs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch tab ────────────────────────────────────────────────────────────

  const switchTab = useCallback(async (id: string) => {
    if (id === activeId) return;
    // Snapshot current editor
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setDocs(prev => prev.map(d => d.id === activeId ? { ...d, html } : d));
    }
    setActiveId(id);
    const doc = docs.find(d => d.id === id);
    if (doc && !doc.loaded) {
      setStatus("loading");
      const text = await driveStore.fetchDoc(id);
      const html = text ? text.replace(/\n/g, "<br>") : "";
      setDocs(prev => prev.map(d => d.id === id ? { ...d, html, loaded: true } : d));
      if (editorRef.current) editorRef.current.innerHTML = html;
      setStatus("idle");
    }
  }, [activeId, docs]);

  // Update editor when switching to an already-loaded tab
  useEffect(() => {
    if (!editorRef.current || !activeId) return;
    const doc = docs.find(d => d.id === activeId);
    if (doc?.loaded) editorRef.current.innerHTML = doc.html;
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ──────────────────────────────────────────────────────────────────

  const save = useCallback(async (docId: string, html: string) => {
    setStatus("saving");
    const text = htmlToText(html);
    const ok = await driveStore.saveDoc(docId, text);
    if (ok) { setStatus("saved"); setTimeout(() => setStatus("idle"), 2000); }
    else { setStatus("error"); setTimeout(() => setStatus("idle"), 3000); }
  }, []);

  // ── Editor input ──────────────────────────────────────────────────────────

  const handleInput = useCallback(() => {
    if (!editorRef.current || !activeId) return;
    const html = editorRef.current.innerHTML;
    setDocs(prev => prev.map(d => d.id === activeId ? { ...d, html } : d));
    setStatus("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(activeId, html), 2000);
  }, [activeId, save]);

  // ── Create new doc ────────────────────────────────────────────────────────

  useEffect(() => {
    if (creating) {
      setNewName("Nouveau document");
      setTimeout(() => { newNameInputRef.current?.select(); }, 50);
    }
  }, [creating]);

  const confirmCreate = useCallback(async () => {
    const name = newName.trim() || "Nouveau document";
    setCreating(false);
    setNewName("");
    if (!folderId) return;
    setStatus("loading");
    const id = await driveStore.createGDoc(name, folderId);
    if (!id) { setStatus("error"); setTimeout(() => setStatus("idle"), 3000); return; }
    if (editorRef.current && activeId) {
      const html = editorRef.current.innerHTML;
      setDocs(prev => prev.map(d => d.id === activeId ? { ...d, html } : d));
    }
    setDocs(prev => [...prev, { id, name, html: "", loaded: true }]);
    setActiveId(id);
    if (editorRef.current) editorRef.current.innerHTML = "";
    setStatus("idle");
  }, [newName, folderId, activeId]);

  // ── Delete doc ───────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (docId: string) => {
    setConfirmDeleteId(null);
    const remaining = docs.filter(d => d.id !== docId);
    const nextActive = remaining.length > 0 ? remaining[0].id : "";
    setDocs(remaining);
    setActiveId(nextActive);
    if (editorRef.current) editorRef.current.innerHTML = "";
    if (nextActive && remaining.find(d => d.id === nextActive)?.loaded) {
      if (editorRef.current) editorRef.current.innerHTML = remaining.find(d => d.id === nextActive)!.html;
    }
    await driveStore.deleteFile(docId);
  }, [docs]);

  // ── Rename doc ────────────────────────────────────────────────────────────

  const handleRename = useCallback(async (docId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    setEditingId(null);
    if (!trimmed) return;
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, name: trimmed } : d));
    await driveStore.renameFile(docId, trimmed);
  }, []);

  // ── Toolbar ───────────────────────────────────────────────────────────────

  const exec = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
  }, []);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    savedSelectionRef.current = (sel && sel.rangeCount > 0)
      ? sel.getRangeAt(0).cloneRange()
      : null;
  }, []);

  const restoreAndExec = useCallback((cmd: string, value: string) => {
    editorRef.current?.focus();
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      if (sel) { sel.removeAllRanges(); sel.addRange(savedSelectionRef.current); }
    }
    document.execCommand(cmd, false, value);
  }, []);

  const setFontSize = (px: string) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (savedSelectionRef.current && sel.rangeCount === 0) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
    if (sel.rangeCount === 0) return;
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

  // ── Status bar ────────────────────────────────────────────────────────────

  const statusEl: Record<Status, React.ReactNode> = {
    loading:   <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span>Chargement…</span></>,
    saving:    <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /><span className="text-primary">Sauvegarde…</span></>,
    saved:     <><CheckCheck className="h-3.5 w-3.5 text-green-400" /><span className="text-green-400">Sauvegardé ✓</span></>,
    idle:      <><CheckCheck className="h-3.5 w-3.5 text-muted-foreground/60" /><span className="text-muted-foreground/60">Connecté au GDoc</span></>,
    error:     <><AlertCircle className="h-3.5 w-3.5 text-destructive" /><span className="text-destructive">Erreur de sauvegarde</span></>,
    no_folder: <><AlertCircle className="h-3.5 w-3.5 text-amber-400" /><span className="text-amber-400">Dossier introuvable</span></>,
  };

  // ── Special screens ───────────────────────────────────────────────────────

  if (status === "loading" && docs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "no_folder") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <AlertCircle className="h-7 w-7 text-amber-400" />
        <div>
          <p className="text-sm font-medium">Dossier Drive introuvable</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crée le dossier <code className="bg-secondary px-1 rounded">Mon Drive / Stockage / Bloc_note</code> dans Google Drive.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Réessayer
        </Button>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Tab bar ── */}
      <div className="flex items-center border-b border-border bg-secondary/20 flex-shrink-0 overflow-x-auto">

        {/* Doc tabs */}
        <div className="flex items-center flex-nowrap flex-1 min-w-0">
          {docs.map(doc => (
            <div
              key={doc.id}
              onClick={() => switchTab(doc.id)}
              className={`flex items-center gap-1 px-3 h-8 text-xs font-medium whitespace-nowrap border-r border-border flex-shrink-0 transition-colors cursor-pointer select-none ${
                activeId === doc.id
                  ? "bg-background text-foreground border-b-2 border-b-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {editingId === doc.id ? (
                <input
                  autoFocus
                  defaultValue={doc.name}
                  className="bg-transparent outline-none border-b border-primary text-xs w-28"
                  onBlur={e => handleRename(doc.id, e.target.value || doc.name)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleRename(doc.id, (e.target as HTMLInputElement).value || doc.name);
                    if (e.key === "Escape") setEditingId(null);
                    e.stopPropagation();
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : confirmDeleteId === doc.id ? (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <span className="text-xs text-destructive">Supprimer ?</span>
                  <button onMouseDown={e => e.preventDefault()} onClick={() => handleDelete(doc.id)} className="text-destructive hover:text-destructive/80 p-0.5" title="Confirmer">
                    <CheckCheck className="h-3 w-3" />
                  </button>
                  <button onMouseDown={e => e.preventDefault()} onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground hover:text-foreground p-0.5" title="Annuler">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 group/tab">
                  <span onDoubleClick={e => { e.stopPropagation(); setEditingId(doc.id); }}>{doc.name}</span>
                  <button
                    onMouseDown={e => e.preventDefault()}
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(doc.id); }}
                    className="opacity-0 group-hover/tab:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5 ml-0.5"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* New doc — inline input or + button */}
          {creating ? (
            <div className="flex items-center gap-1 px-2 h-8 border-r border-border flex-shrink-0">
              <input
                ref={newNameInputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="bg-transparent outline-none border-b border-primary text-xs w-32"
                onKeyDown={e => {
                  if (e.key === "Enter") confirmCreate();
                  if (e.key === "Escape") setCreating(false);
                  e.stopPropagation();
                }}
              />
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={confirmCreate}
                className="text-primary hover:text-primary/80 p-0.5 transition-colors"
                title="Confirmer"
              >
                <CheckCheck className="h-3 w-3" />
              </button>
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => setCreating(false)}
                className="text-muted-foreground hover:text-foreground p-0.5 transition-colors"
                title="Annuler"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="px-2 h-8 flex items-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 flex-shrink-0 transition-colors border-r border-border"
              title="Nouveau document"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-1 px-2 flex-shrink-0 text-xs border-l border-border h-8">
          <div className="flex items-center gap-1">{statusEl[status]}</div>
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={load}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded ml-1"
            title="Recharger"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          {activeId && (
            <a
              href={`https://docs.google.com/document/d/${activeId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
              title="Ouvrir dans Google Docs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* ── Empty state ── */}
      {docs.length === 0 && status === "idle" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">Aucun document dans Stockage/Bloc_note</p>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Créer un document
          </Button>
        </div>
      )}

      {/* ── Toolbar ── */}
      {docs.length > 0 && (
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border flex-shrink-0 flex-wrap">
          <ToolBtn onClick={() => exec("bold")} title="Gras"><Bold className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => exec("italic")} title="Italique"><Italic className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => exec("underline")} title="Souligné"><Underline className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => exec("strikeThrough")} title="Barré"><Strikethrough className="h-3.5 w-3.5" /></ToolBtn>
          <div className="w-px h-4 bg-border mx-0.5" />
          <select
            onMouseDown={() => saveSelection()}
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
          {/* Couleur du texte */}
          <label
            className="relative flex flex-col items-center justify-center w-7 h-6 rounded hover:bg-secondary cursor-pointer select-none"
            title="Couleur du texte — sélectionne du texte puis clique"
            onMouseDown={saveSelection}
          >
            <span className="text-[10px] font-bold text-foreground leading-none">A</span>
            <div className="w-4 h-[3px] rounded-full" style={{ backgroundColor: textColor }} />
            <input
              type="color"
              className="absolute opacity-0 w-0 h-0"
              value={textColor}
              onChange={e => { setTextColor(e.target.value); restoreAndExec("foreColor", e.target.value); }}
            />
          </label>
          {/* Surligneur */}
          <label
            className="relative flex flex-col items-center justify-center w-7 h-6 rounded hover:bg-secondary cursor-pointer select-none"
            title="Surligneur — sélectionne du texte puis clique"
            onMouseDown={saveSelection}
          >
            <span className="text-[10px] font-bold text-foreground leading-none">S</span>
            <div className="w-4 h-[3px] rounded-full" style={{ backgroundColor: highlightColor }} />
            <input
              type="color"
              className="absolute opacity-0 w-0 h-0"
              value={highlightColor}
              onChange={e => { setHighlightColor(e.target.value); restoreAndExec("hiliteColor", e.target.value); }}
            />
          </label>
          <div className="w-px h-4 bg-border mx-0.5" />
          {/* Favoris couleurs */}
          <Star className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          {favorites.map((fav, i) => (
            <button
              key={i}
              className="w-4 h-4 rounded-full border border-border/60 flex-shrink-0 hover:scale-125 transition-transform"
              style={{ backgroundColor: fav }}
              title={`${fav} — clic: couleur texte | clic droit: supprimer`}
              onMouseDown={saveSelection}
              onClick={() => { setTextColor(fav); restoreAndExec("foreColor", fav); }}
              onContextMenu={e => { e.preventDefault(); setFavorites(removeFavorite(fav)); }}
            />
          ))}
          <button
            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={`Ajouter ${textColor} aux favoris`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => setFavorites(addFavorite(textColor))}
          >
            <div className="w-3.5 h-3.5 rounded-full border border-dashed border-current flex items-center justify-center" style={{ backgroundColor: textColor }}>
              <span className="text-[8px] leading-none font-bold" style={{ color: textColor === "#ffffff" || textColor === "#000000" ? (textColor === "#ffffff" ? "#888" : "#fff") : "#fff" }}>+</span>
            </div>
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <ToolBtn onClick={() => exec("justifyLeft")} title="Gauche"><AlignLeft className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => exec("justifyCenter")} title="Centre"><AlignCenter className="h-3.5 w-3.5" /></ToolBtn>
          <ToolBtn onClick={() => exec("justifyRight")} title="Droite"><AlignRight className="h-3.5 w-3.5" /></ToolBtn>
          <div className="w-px h-4 bg-border mx-0.5" />
          <ToolBtn onClick={() => exec("insertUnorderedList")} title="Liste"><List className="h-3.5 w-3.5" /></ToolBtn>
        </div>
      )}

      {/* ── Editor ── */}
      {docs.length > 0 && (
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
            className="h-full p-4 outline-none text-sm overflow-auto leading-relaxed"
            style={{ backgroundColor: "#ffffff", color: "#000000" }}
            spellCheck={false}
          />
        </div>
      )}
    </div>
  );
}
