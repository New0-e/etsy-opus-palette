import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, BarChart3, FlaskConical, Copy, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

const WEBHOOK_PROD = "https://n8n.srv1196541.hstgr.cloud/webhook/43af0a2f-2584-4327-8527-ac204967a1cc";
const WEBHOOK_TEST = "https://n8n.srv1196541.hstgr.cloud/webhook-test/43af0a2f-2584-4327-8527-ac204967a1cc";

interface TagChange {
  old: string;
  new: string;
  reason: string;
}

interface TagResult {
  new_tags: string[];
  old_tags: string[];
  new_tags_string: string;
  changes: TagChange[];
}

function TagPill({ tag, color, copied, onCopy }: {
  tag: string;
  color: string;
  copied: string | null;
  onCopy: (t: string) => void;
}) {
  return (
    <button
      onClick={() => onCopy(tag)}
      title="Copier"
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-opacity hover:opacity-80 ${color}`}
    >
      {copied === tag ? <Check className="h-3 w-3 flex-shrink-0" /> : <Copy className="h-3 w-3 flex-shrink-0" />}
      {tag}
    </button>
  );
}

export default function AnalyseTagsPage() {
  const [tags, setTags] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TagResult | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    setCopied(t);
    setTimeout(() => setCopied(null), 1500);
  };

  const copyAll = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.new_tags_string);
    setCopiedAll(true);
    toast.success("Tous les nouveaux tags copiés !");
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleAnalyse = async () => {
    if (!tags.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(testMode ? WEBHOOK_TEST : WEBHOOK_PROD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags }),
      });
      const raw = await res.text();
      let text = raw;

      // Extraire le texte depuis la réponse brute Gemini
      // Format: [{content:{parts:[{text:"..."}]}}]
      try {
        const json = JSON.parse(raw);
        const arr = Array.isArray(json) ? json : [json];
        const candidate = arr[0];
        const geminiText = candidate?.content?.parts?.[0]?.text
          ?? candidate?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (geminiText) text = geminiText;
        // Format n8n JSON structuré (new_tags / old_tags)
        else if (candidate?.new_tags || candidate?.old_tags) {
          setResult({
            new_tags: Array.isArray(candidate?.new_tags) ? candidate.new_tags : [],
            old_tags: Array.isArray(candidate?.old_tags) ? candidate.old_tags : [],
            new_tags_string: candidate?.new_tags_string ?? "",
            changes: [],
          });
          toast.success("Analyse terminée !");
          return;
        }
      } catch { /* pas du JSON, on traite comme texte brut */ }

      // Parser le texte brut (- Old tags: ... + (old -> new): reason)
      const oldLine = text.match(/[-–]?\s*Old tags:\s*([^\n]+)/i);
      const old_tags = oldLine
        ? oldLine[1].split(",").map(t => t.trim()).filter(Boolean)
        : [];

      const changeRegex = /\(([^)]+?)\s*->\s*([^)]+?)\)\s*:\s*([^\n(]+)/g;
      const changes: TagChange[] = [];
      let m: RegExpExecArray | null;
      while ((m = changeRegex.exec(text)) !== null) {
        changes.push({ old: m[1].trim(), new: m[2].trim(), reason: m[3].trim() });
      }

      const new_tags = changes.map(c => c.new);
      setResult({
        old_tags,
        new_tags,
        new_tags_string: new_tags.join(", "),
        changes,
      });
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
          <Textarea
            rows={6}
            placeholder="Entrez vos tags, un par ligne ou séparés par des virgules..."
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>

        <Button onClick={handleAnalyse} disabled={!tags.trim() || loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          {loading ? "Analyse en cours..." : "Analyser"}
        </Button>

        {result && (
          <div className="space-y-4">

            {/* Comparaison anciens / nouveaux */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-secondary border border-border space-y-3">
                <div className="flex items-center gap-2">
                  <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label className="text-muted-foreground">Anciens tags</Label>
                  <span className="text-xs text-muted-foreground ml-auto">{result.old_tags.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.old_tags.map((tag, i) => (
                    <TagPill key={i} tag={tag} color="bg-secondary border-border text-muted-foreground" copied={copied} onCopy={copy} />
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-secondary border border-primary/30 space-y-3">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-3.5 w-3.5 text-primary" />
                  <Label className="text-primary">Nouveaux tags</Label>
                  <span className="text-xs text-primary/70 ml-auto">{result.new_tags.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.new_tags.map((tag, i) => (
                    <TagPill key={i} tag={tag} color="bg-primary/10 text-primary border-primary/20" copied={copied} onCopy={copy} />
                  ))}
                </div>
              </div>
            </div>

            {/* Chaîne prête à l'emploi */}
            <div className="p-4 rounded-lg bg-secondary border border-border space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-emerald-400">Chaîne prête à l'emploi</Label>
                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={copyAll}>
                  {copiedAll ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedAll ? "Copié !" : "Tout copier"}
                </Button>
              </div>
              <p className="text-xs text-foreground font-mono bg-background/50 rounded px-3 py-2 break-all">
                {result.new_tags_string}
              </p>
            </div>

            {/* Explications des changements */}
            {result.changes.length > 0 && (
              <div className="p-4 rounded-lg bg-secondary border border-border space-y-3">
                <Label className="text-amber-400">Explication des changements</Label>
                <div className="space-y-2">
                  {result.changes.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                        <span className="text-muted-foreground line-through">{c.old}</span>
                        <ArrowRight className="h-3 w-3 text-primary flex-shrink-0" />
                        <span className="text-primary font-medium">{c.new}</span>
                      </div>
                      <span className="text-muted-foreground">— {c.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
