import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Lightbulb, Copy, Check, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { getPageState, setPageState } from "@/lib/pageStore";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/749aeccd-3a6d-473d-b31a-756b5d7a702f";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/749aeccd-3a6d-473d-b31a-756b5d7a702f";

const PAGE_KEY = "generation-idee-sous-niche";
type PageState = { input: string; result: string; testMode: boolean };
const defaults: PageState = { input: "", result: "", testMode: false };

export default function GenerationIdeeSousNichePage() {
  const saved = getPageState<PageState>(PAGE_KEY, defaults);
  const [input, setInputRaw] = useState(saved.input);
  const [result, setResultRaw] = useState(saved.result);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testMode, setTestModeRaw] = useState(saved.testMode);

  const setInput = (v: string) => { setInputRaw(v); setPageState<PageState>(PAGE_KEY, { input: v }); };
  const setResult = (v: string) => { setResultRaw(v); setPageState<PageState>(PAGE_KEY, { result: v }); };
  const setTestMode = (v: boolean) => { setTestModeRaw(v); setPageState<PageState>(PAGE_KEY, { testMode: v }); };

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult("");
    try {
      const url = testMode ? WEBHOOK_TEST : WEBHOOK_PROD;
      const formData = new FormData();
      formData.append("niche", input);
      const res = await fetch(url, { method: "POST", body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setResult(json.text ?? json.output ?? json.result ?? JSON.stringify(json, null, 2));
      } catch {
        setResult(text);
      }
      toast.success("Idées générées !");
    } catch {
      toast.error("Erreur lors de la génération");
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
        <h1 className="font-display text-2xl font-bold">Génération idée sous niche</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>
            Mode test
          </span>
          <Switch checked={testMode} onCheckedChange={setTestMode} />
        </div>
      </div>

      <div className="tool-card space-y-6">
        <div className="space-y-2">
          <Label>Décrivez votre niche</Label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex : bijoux artisanaux pour femmes minimalistes..."
            className="min-h-32 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleGenerate();
            }}
          />
          <p className="text-xs text-muted-foreground">Ctrl+Entrée pour générer</p>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!input.trim() || loading}
          className="w-full gap-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
          {loading ? "Génération en cours..." : "Générer des idées"}
        </Button>

        {(result || loading) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Idées de sous-niches</span>
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
              className="min-h-48 font-mono text-xs resize-none"
              placeholder={loading ? "Génération en cours..." : "Les idées apparaîtront ici..."}
            />
          </div>
        )}
      </div>
    </div>
  );
}
