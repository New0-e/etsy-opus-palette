import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, ImageIcon, Copy, Check, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { driveStore } from "@/lib/driveStore";
import { getPageState, setPageState } from "@/lib/pageStore";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/fa1722ae-5d4a-4b96-b50c-2ff5d22f9227";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/fa1722ae-5d4a-4b96-b50c-2ff5d22f9227";

const PAGE_KEY = "descriptif-image";
type PageState = { result: string };
const defaults: PageState = { result: "" };

export default function DescriptifImagePage() {
  const saved = getPageState<PageState>(PAGE_KEY, defaults);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResultRaw] = useState(saved.result);
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testMode, setTestMode] = useState(false);

  const setResult = (v: string) => { setResultRaw(v); setPageState<PageState>(PAGE_KEY, { result: v }); };

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
    setLoading(true);
    setResult("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(testMode ? WEBHOOK_TEST : WEBHOOK_PROD, { method: "POST", body: formData });
      if (res.status === 404) { toast.error("Webhook introuvable — en mode test, lancez d'abord un test dans n8n"); return; }
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setResult(json.text ?? json.description ?? json.output ?? JSON.stringify(json, null, 2));
      } catch {
        setResult(text);
      }
      toast.success("Analyse terminée !");
    } catch {
      toast.error("Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Descriptif Image</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <Switch checked={testMode} onCheckedChange={setTestMode} id="test-mode" />
          <Label htmlFor="test-mode" className="text-sm text-muted-foreground cursor-pointer">
            {testMode ? "Test" : "Prod"}
          </Label>
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
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="descriptif-img"
              onChange={onInput}
            />
            <label htmlFor="descriptif-img" className="text-xs text-primary cursor-pointer hover:underline mt-2 inline-block">
              {preview ? "Changer l'image" : "Parcourir"}
            </label>
          </div>
        </div>

        <Button onClick={handleAnalyse} disabled={!file || loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          {loading ? "Analyse en cours..." : "Analyser"}
        </Button>

        {(result || loading) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Descriptif généré</span>
              {result && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copié !" : "Copier"}
                </button>
              )}
            </div>
            <Textarea
              value={loading ? "" : result}
              readOnly
              className="min-h-40 font-mono text-xs resize-none"
              placeholder={loading ? "Analyse en cours..." : "Le descriptif apparaîtra ici..."}
            />
          </div>
        )}
      </div>
    </div>
  );
}
