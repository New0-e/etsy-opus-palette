import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, ImageIcon, Copy, Check, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { driveStore } from "@/lib/driveStore";
import { usePageState } from "@/lib/usePageState";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/fa1722ae-5d4a-4b96-b50c-2ff5d22f9227";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/fa1722ae-5d4a-4b96-b50c-2ff5d22f9227";

const PAGE_KEY = "descriptif-image";
type PageState = { resultEn: string; resultFr: string; loading: boolean; translating: boolean };
const defaults: PageState = { resultEn: "", resultFr: "", loading: false, translating: false };

async function translateToFrench(text: string): Promise<string> {
  const res = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|fr`
  );
  const json = await res.json();
  return json.responseData?.translatedText ?? text;
}

export default function DescriptifImagePage() {
  const [state, patch] = usePageState<PageState>(PAGE_KEY, defaults);
  const { resultEn, resultFr, loading, translating } = state;
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [copiedEn, setCopiedEn] = useState(false);
  const [testMode, setTestMode] = useState(false);

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
    patch({ loading: true, resultEn: "", resultFr: "" });
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(testMode ? WEBHOOK_TEST : WEBHOOK_PROD, { method: "POST", body: formData });
      if (res.status === 404) { toast.error("Webhook introuvable — en mode test, lancez d'abord un test dans n8n"); return; }
      const text = await res.text();
      let extracted = text;
      try {
        const json = JSON.parse(text);
        extracted =
          json.content?.parts?.[0]?.text ??
          json.text ?? json.description ?? json.output ??
          JSON.stringify(json, null, 2);
      } catch { /* texte brut */ }

      patch({ resultEn: extracted, loading: false, translating: true });

      try {
        const fr = await translateToFrench(extracted);
        patch({ resultFr: fr, translating: false });
        toast.success("Analyse et traduction terminées !");
      } catch {
        patch({ translating: false });
        toast.success("Analyse terminée (traduction échouée)");
      }
    } catch {
      toast.error("Erreur lors de l'analyse");
      patch({ loading: false, translating: false });
    }
  };

  const copy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const showResults = resultEn || loading || translating;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Descriptif Image</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>Mode test</span>
          <Switch checked={testMode} onCheckedChange={setTestMode} />
        </div>
      </div>

      <div className="tool-card space-y-6">
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Image à analyser</label>
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`dropzone ${dragOver ? "dropzone-active" : ""}`}
          >
            {preview ? (
              <img src={preview} alt="preview" className="max-h-48 mx-auto rounded-lg" />
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Glissez une image ici</p>
              </>
            )}
            <input type="file" accept="image/*" className="hidden" id="descriptif-img" onChange={onInput} />
            <label htmlFor="descriptif-img" className="text-xs text-primary cursor-pointer hover:underline mt-2 inline-block">
              {preview ? "Changer l'image" : "Parcourir"}
            </label>
          </div>
        </div>

        <Button onClick={handleAnalyse} disabled={!file || loading || translating} className="w-full gap-2">
          {(loading || translating) ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          {loading ? "Analyse en cours..." : translating ? "Traduction en cours..." : "Analyser"}
        </Button>

        {showResults && (
          <div className="space-y-4">
            {/* Anglais */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Anglais</span>
                {resultEn && (
                  <button onClick={() => copy(resultEn, setCopiedEn)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {copiedEn ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copiedEn ? "Copié !" : "Copier"}
                  </button>
                )}
              </div>
              <Textarea
                value={loading ? "" : resultEn}
                readOnly
                className="min-h-28 font-mono text-xs resize-none"
                placeholder={loading ? "Analyse en cours..." : ""}
              />
            </div>

            {/* Français */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Français</span>
              </div>
              <Textarea
                value={translating ? "" : resultFr}
                readOnly
                className="min-h-28 font-mono text-xs resize-none"
                placeholder={translating ? "Traduction en cours..." : ""}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
