import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, UserSearch, FlaskConical } from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/221b037d-2a18-4def-a350-0cdf5323197f";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/221b037d-2a18-4def-a350-0cdf5323197f";

export default function TagsConcurrentPage() {
  const [lien, setLien] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [testMode, setTestMode] = useState(false);

  const handleAnalyse = async () => {
    if (!lien.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(testMode ? WEBHOOK_TEST : WEBHOOK_PROD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etsy_url: lien }),
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
        <h1 className="font-display text-2xl font-bold">Tags Concurrent</h1>
        <div className="flex items-center gap-2">
          <FlaskConical className={`h-4 w-4 ${testMode ? "text-amber-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-medium ${testMode ? "text-amber-400" : "text-muted-foreground"}`}>Mode test</span>
          <Switch checked={testMode} onCheckedChange={setTestMode} />
        </div>
      </div>
      <div className="tool-card space-y-6">
        <div className="space-y-2">
          <Label>Lien Etsy du concurrent</Label>
          <Input placeholder="https://www.etsy.com/listing/..." value={lien} onChange={(e) => setLien(e.target.value)} />
        </div>

        <Button onClick={handleAnalyse} disabled={!lien.trim() || loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserSearch className="h-4 w-4" />}
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
