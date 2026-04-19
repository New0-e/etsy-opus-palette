import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Tags, FlaskConical, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { driveStore } from "@/lib/driveStore";
import { usePageState } from "@/lib/usePageState";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/974dfca9-9cfb-4e18-bf37-58b1fd3cbd72";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/974dfca9-9cfb-4e18-bf37-58b1fd3cbd72";

function TagSection({ title, tags, color, copied, onCopy }: {
  title: string;
  tags: string[];
  color: string;
  copied: string | null;
  onCopy: (tag: string) => void;
}) {
  if (!tags?.length) return null;
  return (
    <div className="p-4 rounded-lg bg-secondary border border-border space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-primary">{title}</Label>
        <span className="text-xs text-muted-foreground">{tags.length} tags</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, i) => (
          <button
            key={i}
            onClick={() => onCopy(tag)}
            title="Copier"
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-opacity hover:opacity-80 ${color}`}
          >
            {copied === tag ? <Check className="h-3 w-3 flex-shrink-0" /> : <Copy className="h-3 w-3 flex-shrink-0" />}
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}

type AnalyseResult = { descriptive_keywords: string[]; buying_intent: string[]; search_queries: string[] };
const PAGE_KEY = "analyse-image";
type PageState = { result: AnalyseResult | null; testMode: boolean; loading: boolean };
const defaults: PageState = { result: null, testMode: false, loading: false };

export default function AnalyseImagePage() {
  const [state, patch] = usePageState<PageState>(PAGE_KEY, defaults);
  const { result, testMode, loading } = state;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const driveId = e.dataTransfer.getData("drive-item-id");
    const driveName = e.dataTransfer.getData("drive-item-name");
    if (driveId) {
      const f = await driveStore.fetchAsFile(driveId, driveName);
      if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
      return;
    }

    const f = e.dataTransfer.files[0];
    if (f?.type.startsWith("image/")) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  }, []);

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setPreview(URL.createObjectURL(f)); }
  };

  const handleAnalyse = async () => {
    if (!file) return;
    patch({ loading: true });
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(testMode ? WEBHOOK_TEST : WEBHOOK_PROD, {
        method: "POST",
        body: formData,
      });
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        patch({ result: json });
      } catch {
        patch({ result: { descriptive_keywords: [], buying_intent: [], search_queries: [text] } });
      }
      toast.success("Analyse terminée !");
    } catch {
      toast.error("Erreur lors de l'analyse");
    } finally {
      patch({ loading: false });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Analyse Image</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>Mode test</span>
          <Switch checked={testMode} onCheckedChange={(v) => patch({ testMode: v })} />
        </div>
      </div>
      <div className="tool-card space-y-6">
        <div>
          <Label className="mb-2 block">Image à analyser</Label>
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`dropzone ${dragOver ? "dropzone-active" : ""}`}
          >
            {preview ? (
              <img src={preview} className="max-h-48 mx-auto rounded-lg" />
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Glissez une image ici</p>
              </>
            )}
            <input type="file" accept="image/*" className="hidden" id="analyse-img" onChange={onInput} />
            <label htmlFor="analyse-img" className="text-xs text-primary cursor-pointer hover:underline mt-2 inline-block">
              {preview ? "Changer l'image" : "Parcourir"}
            </label>
          </div>
        </div>

        <Button onClick={handleAnalyse} disabled={!file || loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tags className="h-4 w-4" />}
          {loading ? "Analyse en cours..." : "Analyser"}
        </Button>

        {result && (
          <div className="space-y-4">
            <TagSection
              title="Mots-clés descriptifs"
              tags={result.descriptive_keywords}
              color="bg-primary/10 text-primary border-primary/20"
              copied={copied}
              onCopy={(tag) => { navigator.clipboard.writeText(tag); setCopied(tag); setTimeout(() => setCopied(null), 1500); }}
            />
            <TagSection
              title="Intention d'achat"
              tags={result.buying_intent}
              color="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              copied={copied}
              onCopy={(tag) => { navigator.clipboard.writeText(tag); setCopied(tag); setTimeout(() => setCopied(null), 1500); }}
            />
            <TagSection
              title="Requêtes de recherche"
              tags={result.search_queries}
              color="bg-orange-500/10 text-orange-400 border-orange-500/20"
              copied={copied}
              onCopy={(tag) => { navigator.clipboard.writeText(tag); setCopied(tag); setTimeout(() => setCopied(null), 1500); }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
