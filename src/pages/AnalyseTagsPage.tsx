import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, BarChart3, FlaskConical } from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/43af0a2f-2584-4327-8527-ac204967a1cc";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/43af0a2f-2584-4327-8527-ac204967a1cc";

export default function AnalyseTagsPage() {
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [testMode, setTestMode] = useState(false);

  const handleAnalyse = async () => {
    if (!tags.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(testMode ? WEBHOOK_TEST : WEBHOOK_PROD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: tags }),
      });
      const data = await res.text();
      setResult(data);
      toast.success("Analyse terminée !");
    } catch {
      toast.error("Erreur lors de l'analyse");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Analyse Tags</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>Mode test</span>
          <Switch checked={testMode} onCheckedChange={setTestMode} />
        </div>
      </div>
      <div className="tool-card space-y-6">
        <div className="space-y-2">
          <Label>Liste de tags</Label>
          <Textarea rows={6} placeholder="Entrez vos tags, un par ligne ou séparés par des virgules..." value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>

        <Button onClick={handleAnalyse} disabled={!tags.trim() || loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          {loading ? "Analyse en cours..." : "Analyser"}
        </Button>

        {result && (
          <div className="p-4 rounded-lg bg-secondary border border-border">
            <Label className="mb-2 block text-primary">Résultat</Label>
            <p className="text-sm text-foreground whitespace-pre-wrap">{result}</p>
          </div>
        )}
      </div>
    </div>
  );
}
