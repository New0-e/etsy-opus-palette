import { useState, useEffect } from "react";
import { Loader2, Save, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { driveStore } from "@/lib/driveStore";
import { toast } from "sonner";

function extractDocId(url: string): string | null {
  return url.match(/document\/d\/([a-zA-Z0-9-_]+)/)?.[1] ?? null;
}

export function DocViewer({ url }: { url: string }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const docId = extractDocId(url);

  useEffect(() => {
    if (!docId) { setError("URL invalide"); setLoading(false); return; }
    setLoading(true);
    driveStore.fetchDoc(docId).then(content => {
      if (content === null) setError("Impossible de charger le document");
      else { setText(content); setDirty(false); }
      setLoading(false);
    });
  }, [docId]);

  const handleSave = async () => {
    if (!docId) return;
    setSaving(true);
    const ok = await driveStore.saveDoc(docId, text);
    setSaving(false);
    if (ok) { toast.success("Document sauvegardé"); setDirty(false); }
    else toast.error("Reconnecte Drive (déconnecte → reconnecte) pour activer la sauvegarde");
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" />
      <p className="text-sm text-destructive">{error}</p>
      <a href={url} target="_blank" rel="noreferrer">
        <Button variant="outline" size="sm" className="gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" />
          Ouvrir dans Google Docs
        </Button>
      </a>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-background flex-shrink-0">
        <Save className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground flex-1">Bloc-notes — édite directement</span>
        <a href={url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground mr-2">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="h-6 text-xs px-2.5 gap-1"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          {saving ? "Sauvegarde…" : "Sauvegarder"}
        </Button>
      </div>
      <textarea
        className="flex-1 resize-none bg-background text-foreground text-sm font-mono p-4 outline-none border-0 leading-relaxed"
        value={text}
        onChange={e => { setText(e.target.value); setDirty(true); }}
        placeholder="Document vide…"
        spellCheck={false}
      />
    </div>
  );
}
